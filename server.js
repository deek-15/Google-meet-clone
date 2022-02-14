const express = require("express");
const path = require("path");
const fs = require("fs");
const fileUpload = require("express-fileupload");
var app = express();
var server = app.listen(process.env.PORT || 3000,()=>{
    console.log("Listening on port 3000");
});
const io = require("socket.io")(server,{
    allowEIO3: true
});
app.use(express.static(path.join(__dirname,"")));
var userConnections = [];
var otherUsers = [];
io.on("connection", (socket)=>{
    console.log("Socket id is", socket.id);
    socket.on("userconnect", (data)=>{
        console.log("userconnect",data.displayName,data.meetingid);
        otherUsers = userConnections.filter((p)=> p.meeting_id == data.meetingid);
        userConnections.push({
            connectionID: socket.id,
            user_id: data.displayName,
            meeting_id: data.meetingid,
        });
        var userCount = userConnections.length;
        console.log(userCount);
        console.log(otherUsers.length);
        otherUsers.forEach((v)=> {
            socket.to(v.connectionID).emit("inform_others_about_me",{
                other_user_id: data.displayName,
                connId: socket.id,
                userNumber: userCount
            });
        })
        socket.emit("inform_me_about_other_user",otherUsers);

    });
    socket.on("SDPProcess",(data)=>{
        socket.to(data.to_connid).emit("SDPProcess",{
            message: data.message,
            from_connid: socket.id
        })
    })
    socket.on("sendMessage", (msg)=>{
        console.log(msg);
        var mUser = userConnections.find((p)=>p.connectionID == socket.id);
        if(mUser){
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p)=>p.meeting_id == meetingid);
            list.forEach((v)=>{
                socket.to(v.connectionID).emit("showChatMessage", {
                    from: from,
                    message: msg
                })
            })
        }
    });
    socket.on("fileTransferToOther", (msg)=>{
        console.log(msg);
        var mUser = userConnections.find((p)=>p.connectionID == socket.id);
        if(mUser){
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p)=>p.meeting_id == meetingid);
            list.forEach((v)=>{
                socket.to(v.connectionID).emit("showFileMessage", {
                    username: msg.username,
                    meetingid: msg.meetingid,
                    filePath: msg.filePath,
                    fileName: msg.fileName
                })
            })
        }
    });
    socket.on("disconnect",function(){
        console.log("User disconnected");
        var disUser = userConnections.find((p)=> p.connectionID == socket.id);
        if(disUser){
            var meetingid = disUser.meeting_id;
            userConnections = userConnections.filter((p)=> p.connectionID != socket.id);
            var list = userConnections.filter((p)=> p.meeting_id == meetingid);
            list.forEach((v)=>{
                var userNumAfterUserLeave = userConnections.length;
                socket.to(v.connectionID).emit("inform_other_about_disconnected_user",{
                    connId: socket.id,
                    uNum: userNumAfterUserLeave
                });
            });
        }
    });
});
app.use(fileUpload());
app.post("/attachimg", function(req,res){
    var data = req.body;
    var imageFile = req.files.zipfile;
    console.log(imageFile);
    var dir = "public/attachment/"+data.meeting_id+"/";
    if(!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }

    imageFile.mv("public/attachment/"+data.meeting_id+"/"+imageFile.name,function(err){
        if(err) {
            console.log("Could not upload the image file, error:",err);
        }
        else{
            console.log("Image file successfully uploaded");
        }
    });
});