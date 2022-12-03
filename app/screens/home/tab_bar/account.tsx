// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import React from 'react';
import {Image, View} from 'react-native';

// import ProfilePicture from '@components/profile_picture';
import {observeCurrentUser} from '@queries/servers/user';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import type {WithDatabaseArgs} from '@typings/database/database';
import type UserModel from '@typings/database/models/servers/user';
import { BOTTOM_TAB_ICON_SIZE } from '@app/constants/view';

type Props = {
    currentUser: UserModel;
    isFocused: boolean;
    theme: Theme;
}


const Account = ({currentUser, isFocused, theme}: Props) => {

    return (
        <View>
            {<Image
                            source={require('@assets/images/profile.png')}
                            style={{height: BOTTOM_TAB_ICON_SIZE , resizeMode: 'contain', tintColor: (isFocused ? theme.buttonBg : changeOpacity(theme.centerChannelColor, 0.48))}}
                        />}
        </View>
    );
};

const withCurrentUser = withObservables([], ({database}: WithDatabaseArgs) => ({
    currentUser: observeCurrentUser(database),
}));

export default withDatabase(withCurrentUser(Account));
