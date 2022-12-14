// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Database, Q, Query} from '@nozbe/watermelondb';
import {combineLatest, of as of$, Observable} from 'rxjs';
import {map, switchMap, distinctUntilChanged} from 'rxjs/operators';

import {Preferences} from '@constants';
import {MM_TABLES} from '@constants/database';
import {processIsCRTEnabled} from '@utils/thread';

import {queryPreferencesByCategoryAndName} from './preference';
import {getConfig, observeConfigValue} from './system';

import type ServerDataOperator from '@database/operator/server_data_operator';
import type Model from '@nozbe/watermelondb/Model';
import type ThreadModel from '@typings/database/models/servers/thread';
import type UserModel from '@typings/database/models/servers/user';

const {SERVER: {CHANNEL, POST, THREAD, THREADS_IN_TEAM, THREAD_PARTICIPANT, USER}} = MM_TABLES;

export const getIsCRTEnabled = async (database: Database): Promise<boolean> => {
    const config = await getConfig(database);
    const preferences = await queryPreferencesByCategoryAndName(database, Preferences.CATEGORY_DISPLAY_SETTINGS).fetch();
    return processIsCRTEnabled(preferences, config?.CollapsedThreads, config?.FeatureFlagCollapsedThreads);
};

export const getThreadById = async (database: Database, threadId: string) => {
    try {
        const thread = await database.get<ThreadModel>(THREAD).find(threadId);
        return thread;
    } catch {
        return undefined;
    }
};

export const observeIsCRTEnabled = (database: Database) => {
    const cfgValue = observeConfigValue(database, 'CollapsedThreads');
    const featureFlag = observeConfigValue(database, 'FeatureFlagCollapsedThreads');
    const preferences = queryPreferencesByCategoryAndName(database, Preferences.CATEGORY_DISPLAY_SETTINGS).observeWithColumns(['value']);
    return combineLatest([cfgValue, featureFlag, preferences]).pipe(
        map(
            ([cfgV, ff, prefs]) => processIsCRTEnabled(prefs, cfgV, ff),
        ),
        distinctUntilChanged(),
    );
};

export const observeThreadById = (database: Database, threadId: string) => {
    return database.get<ThreadModel>(THREAD).query(
        Q.where('id', threadId),
    ).observe().pipe(
        switchMap((threads) => threads[0]?.observe() || of$(undefined)),
    );
};

export const observeTeamIdByThread = (thread: ThreadModel) => {
    return thread.post.observe().pipe(
        switchMap((post) => {
            if (!post) {
                return of$(undefined);
            }
            return post.channel.observe().pipe(
                switchMap((channel) => of$(channel?.teamId)),
            );
        }),
    );
};

export const observeUnreadsAndMentionsInTeam = (database: Database, teamId?: string, includeDmGm?: boolean): Observable<{unreads: boolean; mentions: number}> => {
    const observeThreads = () => queryThreads(database, teamId, true, includeDmGm).
        observeWithColumns(['unread_replies', 'unread_mentions']).
        pipe(
            switchMap((threads) => {
                let unreads = false;
                let mentions = 0;
                for (const thread of threads) {
                    unreads = unreads || Boolean(thread.unreadReplies);
                    mentions += thread.unreadMentions;
                }

                return of$({unreads, mentions});
            }),
        );

    return observeIsCRTEnabled(database).pipe(
        switchMap((hasCRT) => (hasCRT ? observeThreads() : of$({unreads: false, mentions: 0}))),
        distinctUntilChanged((x, y) => x.mentions === y.mentions && x.unreads === y.unreads),
    );
};

// On receiving "posts", Save the "root posts" as "threads"
export const prepareThreadsFromReceivedPosts = async (operator: ServerDataOperator, posts: Post[], updateLastFetchAt: boolean) => {
    const models: Model[] = [];
    const threads: ThreadWithLastFetchedAt[] = [];
    const toUpdate: {[rootId: string]: number | undefined} = {};
    let processedThreads: Set<string> | undefined;

    posts.forEach((post: Post) => {
        if (!post.root_id && post.type === '') {
            threads.push({
                id: post.id,
                participants: post.participants,
                reply_count: post.reply_count,
                last_reply_at: post.last_reply_at,
                is_following: post.is_following,
                lastFetchedAt: post.create_at,
            } as ThreadWithLastFetchedAt);
        } else if (post.root_id && updateLastFetchAt) {
            toUpdate[post.root_id] = Math.max(toUpdate[post.root_id] || 0, post.create_at, post.update_at, post.delete_at);
        }
    });

    if (threads.length) {
        const threadModels = await operator.handleThreads({threads, prepareRecordsOnly: true}) as ThreadModel[];
        processedThreads = new Set<string>(threadModels.map((t) => t.id));
        models.push(...threadModels);
    }

    const toUpdateKeys = Object.keys(toUpdate);
    if (toUpdateKeys.length) {
        const toUpdateThreads = await Promise.all(toUpdateKeys.map((key) => getThreadById(operator.database, key)));
        for (const thread of toUpdateThreads) {
            if (thread && !processedThreads?.has(thread.id)) {
                const model = thread.prepareUpdate((record) => {
                    record.lastFetchedAt = Math.max(record.lastFetchedAt, toUpdate[thread.id] || 0);
                });
                models.push(model);
            }
        }
    }

    return models;
};

export const queryThreadsInTeam = (database: Database, teamId: string, onlyUnreads?: boolean, hasReplies?: boolean, isFollowing?: boolean, sort?: boolean, limit?: number): Query<ThreadModel> => {
    const query: Q.Clause[] = [];

    if (isFollowing) {
        query.push(Q.where('is_following', true));
    }

    if (hasReplies) {
        query.push(Q.where('reply_count', Q.gt(0)));
    }

    if (onlyUnreads) {
        query.push(Q.where('unread_replies', Q.gt(0)));
    }

    if (sort) {
        query.push(Q.sortBy('last_reply_at', Q.desc));
    }

    let joinCondition: Q.Condition = Q.where('team_id', teamId);

    if (!onlyUnreads) {
        joinCondition = Q.and(
            Q.where('team_id', teamId),
            Q.where('loaded_in_global_threads', true),
        );
    }

    query.push(
        Q.on(THREADS_IN_TEAM, joinCondition),
    );

    if (limit) {
        query.push(Q.take(limit));
    }

    return database.get<ThreadModel>(THREAD).query(...query);
};

export async function getNewestThreadInTeam(
    database: Database,
    teamId: string,
    unread: boolean,
): Promise<ThreadModel | undefined> {
    try {
        const threads = await queryThreadsInTeam(database, teamId, unread, true, true, true, 1).fetch();
        return threads?.[0] || undefined;
    } catch (e) {
        return undefined;
    }
}

export function observeThreadMentionCount(database: Database, teamId?: string, includeDmGm?: boolean): Observable<number> {
    return observeUnreadsAndMentionsInTeam(database, teamId, includeDmGm).pipe(
        switchMap(({mentions}) => of$(mentions)),
        distinctUntilChanged(),
    );
}

export const queryThreads = (database: Database, teamId?: string, onlyUnreads = false, includeDmGm = true): Query<ThreadModel> => {
    const query: Q.Clause[] = [
        Q.where('is_following', true),
        Q.where('reply_count', Q.gt(0)),
    ];

    // If teamId is specified, only get threads in that team
    if (teamId) {
        let condition: Q.Condition = Q.where('team_id', teamId);

        if (includeDmGm) {
            condition = Q.or(
                Q.where('team_id', teamId),
                Q.where('team_id', ''),
            );
        }

        query.push(
            Q.experimentalNestedJoin(POST, CHANNEL),
            Q.on(POST, Q.on(CHANNEL, condition)),
        );
    } else if (!includeDmGm) {
        // fetching all threads from all teams
        // excluding DM/GM channels
        query.push(
            Q.experimentalNestedJoin(POST, CHANNEL),
            Q.on(POST, Q.on(CHANNEL, Q.where('team_id', Q.notEq('')))),
        );
    }

    if (onlyUnreads) {
        query.push(Q.where('unread_replies', Q.gt(0)));
    }

    return database.get<ThreadModel>(THREAD).query(...query);
};

export const queryThreadParticipants = (database: Database, threadId: string) => {
    return database.get<UserModel>(USER).query(
        Q.on(THREAD_PARTICIPANT, Q.where('thread_id', threadId)),
    );
};
