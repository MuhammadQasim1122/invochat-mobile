// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {tableSchema} from '@nozbe/watermelondb';

import {MM_TABLES} from '@constants/database';

const {THREADS_IN_TEAM} = MM_TABLES.SERVER;

export default tableSchema({
    name: THREADS_IN_TEAM,
    columns: [
        {name: 'loaded_in_global_threads', type: 'boolean', isIndexed: true},
        {name: 'team_id', type: 'string', isIndexed: true},
        {name: 'thread_id', type: 'string', isIndexed: true},
    ],
});
