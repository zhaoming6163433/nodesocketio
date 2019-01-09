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
            
            //将新加入用户socket存放arrAllSocket
            socket.name = client_s+"."+roomid;
            var isflag1 = true;
            var userid = client_s+'.'+roomid;
            for(var key in arrAllSocket){
                if(key==userid){
                    isflag1 = false;
                }
            }
            if(isflag1){
                arrAllSocket[userid] = socket;
            }
            //向指定客户端广播用户加入
            //socket.emit('news', roomIpArry);

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
        //监听用户发布聊天内容
        socket.on('message', function(obj){
            console.log(obj)

        });
        //房间列表
        socket.on('getroomlist',function(obj){
            socket.emit('roomlist', roomInfo);
        });
        //监听创建房间
        socket.on('createroom',function(obj){
            var client_s = getip(socket);
            var _obj = {roomid:uuidV4(),createrip:client_s,roominfo:obj}    
            roomInfo.push(_obj);
            io.emit('roomlist', roomInfo);
        });
    
    });
}