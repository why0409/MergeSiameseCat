module.exports = {
    container: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },

    header: {
        width: '100%',
        height: '10%',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#f8f1e6', // 背景色调整为和游戏一致
        borderBottomWidth: 0.5,
        borderColor: 'rgba(0, 0, 0, 0.3)',
    },

    title: {
        width: '10%',
        height: '100%',
        fontSize: 35,
        lineHeight: 80,
        textAlign: 'center',
        fontWeight: 'bold',
        color: '#5c4033',
    },

    rankList: {
        width: '100%',
        height: '90%',
        backgroundColor: '#ffffff',
    },

    list: {
        width: '100%',
        height: '88%',
        backgroundColor: '#ffffff',
        marginTop: 10,
    },

    listTips: {
        width: '100%',
        height: '12%',
        lineHeight: 90,
        textAlign: 'center',
        fontSize: 25,
        color: 'rgba(0,0,0,0.5)',
        backgroundColor: '#f8f1e6',
    },

    listItem: {
        backgroundColor: '#F7F7F7',
        width: '100%',
        height: '10%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    listItemOld: {
       backgroundColor: '#ffffff',
    },

    listItemUserData: {
        width: '75%',
        height: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },

    listItemScore: {
        width: '25%',
        height: 100,
        fontSize: 33,
        fontWeight: 'bold',
        lineHeight: 100,
        textAlign: 'center',
        color: '#5c4033',
    },

    listItemNum: {
        width: 100,
        height: 80,
        fontSize: 30,
        fontWeight: 'bold',
        color: '#452E27',
        lineHeight: 100,
        textAlign: 'center',
    },

    listHeadImg: {
        borderRadius: 35, // 圆形头像
        width: 70,
        height: 70,
    },

    listItemName: {
        width: 210,
        height: 100,
        fontSize: 30,
        lineHeight: 100,
        marginLeft: 30,
        color: '#452E27',
    },
};
