// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Image, View} from 'react-native';

import {BOTTOM_TAB_ICON_SIZE} from '@constants/view';
import {changeOpacity} from '@utils/theme';

type Props = {
    isFocused: boolean;
    theme: Theme;
}

const Mentions = ({isFocused, theme}: Props) => {
    return (
        <View>
            {<Image
                            source={require('@assets/images/mention.png')}
                            style={{height: BOTTOM_TAB_ICON_SIZE , resizeMode: 'contain', tintColor: (isFocused ? theme.buttonBg : changeOpacity(theme.centerChannelColor, 0.48))}}
                        />}
        </View>
    );
};

export default Mentions;
