const uuidV4 = require('uuid/v4');
exports.connctsocketfn = function(server){
    const io = require('socket.io').listen(server);
    let roomIpArry = [];//房间用户json数组
    let arrAllSocket = {};//存放用户socket的对象，根据IP.roomid来存放
    let roomInfo = [];//缓存所有房间信息包括创建者IP标识
    function getip(socket){
        var client_s = socket.handshake.headers['x-real-ip'] || socket.handshake.address;
            client_s = client_s.substr(client_s.lastIndexOf(":")+1);
            return client_s;
    }
    //分发给当前房间的用户
    function sendroom(myroominfo,roomid){
        //分发给当前房间的用户
        var _socketarr = [];
        for(var key in arrAllSocket){
            if(key.indexOf(roomid) != -1){
                _socketarr.push(arrAllSocket[key]);
            }
        }
        for(var j=0;j<_socketarr.length;j++){
            var _socket = _socketarr[j];
            _socket.emit('roominfo', myroominfo, getip(_socket));
        }
    }
    io.on('connection', function(socket){
        //监听新用户加入
        socket.on('joinroom', function(obj){
            var client_s = getip(socket);
            let roomid = obj.roomid;

            //存在相同IP和房间ID就不添加
            var isflag = true;
            for(var i=0;i<roomIpArry.length;i++){
                var _obj = roomIpArry[i];
                if(_obj.ip==client_s&&_obj.roomid==roomid){
                    isflag = false;
                }
            }
            if(isflag){
                roomIpArry.push({ip:client_s,roomid:roomid})
            }
            
            //将新加入用户socket存放arrAllSocket每次进入详情都重新连接,有就替换没有就新增
            socket.name = client_s+"."+roomid;
            var userid = client_s+'.'+roomid;
            arrAllSocket[userid] = socket;
            //向当前客户端展示房间信息
            var roominfo = {};
            roomInfo.forEach(function(item){
                if(item.roomid == roomid){
                    roominfo = item;
                }
            });
            socket.emit('roominfo', roominfo, getip(socket));
        });
        
        //监听用户退出某个房间
        socket.on('logout', function(obj){
            if(Object.prototype.toString.call(obj)=="[object Object]"){
                var client_s = socket.handshake.headers['x-real-ip'] || socket.handshake.address;
                client_s = client_s.substr(client_s.lastIndexOf(":")+1);
                var roomid = obj.roomid;
                //将退出的用户从在线列表中删除
                if(arrAllSocket.hasOwnProperty(socket.name)) {
                    //退出用户的信息
                    var userid = client_s+'.'+roomid;
                    //删除socket和房间
                    delete arrAllSocket[userid];
                }
                //删除退出的socket数组对象
                var _newarr = [];
                for(var i=0;i<roomIpArry.length;i++){
                    var ip = roomIpArry[i].ip;
                    var _roomid = roomIpArry[i].roomid;
                    if(client_s != ip||_roomid != roomid){
                        _newarr.push(roomIpArry[i]);
                    }
                }
                roomIpArry = _newarr;
            }
        });
        //房间列表
        socket.on('getroomlist',function(obj){
            socket.emit('roomlist', roomInfo , getip(socket));
        });
        //监听创建房间
        socket.on('createroom',function(obj){
            var client_s = getip(socket);
            var _obj = {
                roomid:uuidV4(),//房间id
                createrip:client_s,//创建者ip
                roomflag:0,//房间状态 0进行中 1已截止
                roomresultflag:false,//是否产生最终结果
                roomresult:"",//结果
                roominfo:obj,//房间信息
                selectediparr:[]//加入者ip
            };  
            roomInfo.push(_obj);
            io.emit('roomlist', roomInfo);
        });
        //删除房间
        socket.on('delroom',function(obj){
            roomInfo.forEach(function(item,index){
                if(item.roomid == obj.roomid){
                    roomInfo.splice(index,1);
                }
            });
            //推送所有
            io.emit('roomlist', roomInfo);
        });
        //终止投票
        socket.on('stoproom',function(obj){
            roomInfo.forEach(function(item,index){
                if(item.roomid == obj.roomid){
                    item.roomflag = 1;
                    //推送给进入房间的人民
                    sendroom(item,item.roomid);
                }
            });
            //推送所有列表
            io.emit('roomlist', roomInfo);
        });
        //对房间信息提交后进行修改并发送到房间的每个用户
        socket.on('submitroom',function(obj){
            var ip = getip(socket);
            var roomid = obj.roomid;
            var thingval = obj.thingval;
            var myroominfo = {};
            roomInfo.forEach(function(item){
                if(item.roomid == roomid){
                    var isselected = false;
                    for(var i=0;i<item.selectediparr.length;i++){
                        if(item.selectediparr[i]==ip){
                            isselected = true;
                        }
                    }
                    //把投票结果存到roominfo里面 并投过票的ip放到数组里面
                    if(!isselected){
                        item.selectediparr.push(ip);
                        item.roominfo.addthinglist.forEach(function(item1){
                            if(item1.id == thingval){
                                item1.num = item1.num+1;
                            }
                        });
                    }
                    myroominfo = item;
                    //分发给当前房间的用户
                    sendroom(myroominfo,roomid);
                }
            });
        });

        //直接产生结果
        socket.on('zhijieresult', function(obj){
            let roomid = obj.roomid;
            var roominfo = {};
            roomInfo.forEach(function(item){
                if(item.roomid == roomid){
                    item.roomresultflag = true;
                    //计算投票结果 获取最大的几个然后随机选择一个
                    var lastarr = [].concat(item.roominfo.addthinglist);
                    lastarr.sort(function(a,b){
                        return b.num-a.num;
                    });
                    var _num = lastarr[0].num;
                    var lastarr1 = [];
                    lastarr.forEach(function(item){
                        if(_num==item.num){
                            lastarr1.push(item);
                        }
                    });
                    item.roomresult = lastarr1[Math.floor(Math.random()*lastarr1.length)];
                    roominfo = item;
                    //推送给进入房间的人民
                    sendroom(item,roomid);
                }
            });

            socket.emit('roominfo', roominfo, getip(socket));
        });

        //按权重值随机产生结果
        socket.on('randomresult', function(obj){
            let roomid = obj.roomid;
            var roominfo = {};
            roomInfo.forEach(function(item){
                if(item.roomid == roomid){
                    item.roomresultflag = true;
                    //计算投票结果 获取最大的几个然后随机选择一个
                    var lastarr = [].concat(item.roominfo.addthinglist);
                    var randomnumarr = [];//存放区间数组用于随机的
                    var totalnum = 0;
                    var randommath = Math.ceil(Math.random()*100);
                    randomnumarr.push(0);
                    for(var i=0;i<lastarr.length;i++){
                        totalnum = totalnum+lastarr[i].num;
                    }
                    for(var j=0;j<lastarr.length;j++){
                        if(totalnum!=0){
                            if(j>0){
                                randomnumarr.push(Math.ceil((randomnumarr[j-1]/100+lastarr[j].num/totalnum)*100))
                            }else{
                                randomnumarr.push(Math.ceil((lastarr[j].num/totalnum)*100))
                            }
                        }
                    }

                    for(var i=0;i<randomnumarr.length-1;i++){
                        var one = randomnumarr[i];
                        var two = randomnumarr[i+1]
                        if(randommath==0){
                            item.roomresult = lastarr[0];
                            break;
                        }
                        if(randommath>one&&randommath<=two){
                            item.roomresult = lastarr[i];
                            break;
                        }
                    }
                    roominfo = item;
                    //推送给进入房间的人民
                    sendroom(item,roomid);
                }
            });

            socket.emit('roominfo', roominfo, getip(socket));
        });
    });
}