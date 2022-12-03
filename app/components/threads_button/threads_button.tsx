// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {Image, Text, TouchableOpacity, View} from 'react-native';

import {switchToGlobalThreads} from '@actions/local/thread';
import Badge from '@components/badge';
import {
    getStyleSheet as getChannelItemStyleSheet,
    textStyle as channelItemTextStyle,
} from '@components/channel_item/channel_item';
import FormattedText from '@components/formatted_text';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {useIsTablet} from '@hooks/device';
import {preventDoubleTap} from '@utils/tap';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    baseContainer: {
        marginLeft: -18,
        marginRight: -20,
    },
    icon: {
        color: changeOpacity(theme.sidebarText, 0.5),
        fontSize: 24,
    },
    iconActive: {
        color: theme.sidebarText,
    },
    iconInfo: {
        color: changeOpacity(theme.centerChannelColor, 0.72),
    },
    text: {
        flex: 1,
    },
}));

type Props = {
    currentChannelId: string;
    groupUnreadsSeparately: boolean;
    isInfo?: boolean;
    onlyUnreads: boolean;
    onPress?: () => void;
    unreadsAndMentions: {
        unreads: boolean;
        mentions: number;
    };
};

const ThreadsButton = ({currentChannelId, groupUnreadsSeparately, isInfo, onlyUnreads, onPress, unreadsAndMentions}: Props) => {
    const isTablet = useIsTablet();
    const serverUrl = useServerUrl();

    const theme = useTheme();
    const styles = getChannelItemStyleSheet(theme);
    const customStyles = getStyleSheet(theme);

    const handlePress = useCallback(preventDoubleTap(() => {
        if (onPress) {
            onPress();
        } else {
            switchToGlobalThreads(serverUrl);
        }
    }), [onPress, serverUrl]);

    const {unreads, mentions} = unreadsAndMentions;
    const isActive = isTablet && !currentChannelId;

    const [containerStyle, iconStyle, textStyle, badgeStyle] = useMemo(() => {
        const container = [
            styles.container,
            isActive && styles.activeItem,
        ];

        const icon = [
            customStyles.icon,
            (isActive || unreads) && customStyles.iconActive,
            isInfo && customStyles.iconInfo,
        ];

        const text = [
            customStyles.text,
            unreads ? channelItemTextStyle.bold : channelItemTextStyle.regular,
            styles.text,
            unreads && styles.highlight,
            isActive && styles.textActive,
            isInfo && styles.textInfo,
        ];

        const badge = [
            styles.badge,
            isInfo && styles.infoBadge,
        ];

        return [container, icon, text, badge];
    }, [customStyles, isActive, isInfo, styles, unreads]);

    if (groupUnreadsSeparately && (onlyUnreads && !isActive && !unreads && !mentions)) {
        return null;
    }

    return (
        <TouchableOpacity
            onPress={handlePress}
            testID='channel_list.threads.button'
        >
            <Text style={{color: changeOpacity(theme.sidebarText, 0.48),marginLeft:10, marginBottom:10}}>Main Menu</Text>
            <View style={customStyles.baseContainer}>
                <View style={containerStyle}>
                    <Image 
                            source={require('@assets/images/Chat.png')}
                            style={{tintColor: changeOpacity(theme.sidebarText, 1)}}
                        />
                    <FormattedText
                        id='threads'
                        defaultMessage='Threads'
                        style={textStyle}
                    />
                    <Badge
                        value={mentions}
                        style={badgeStyle}
                        visible={mentions > 0}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default React.memo(ThreadsButton);
