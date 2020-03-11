//. app.js

var express = require( 'express' ),
    basicAuth = require( 'basic-auth-connect' ),
    i18n = require( 'i18n' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    ejs = require( 'ejs' ),
    uuidv1 = require( 'uuid/v1' ),
    app = express();
var http = require( 'http' ).createServer( app );
var io = require( 'socket.io' ).listen( http );

var settings = require( './settings' );


app.all( '/view', basicAuth( function( user, pass ){
  if( settings.admin_username && settings.admin_password ){
    return ( settings.admin_username === user && settings.admin_password === pass );
  }else{
    return false;
  }
}));

app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

//. i18n
i18n.configure({
  locales: ['ja', 'en'],
  directory: __dirname + '/locales'
});
app.use( i18n.init );

app.get( '/client', function( req, res ){
  var name = req.query.name;
  if( !name ){ name = '' + ( new Date() ).getTime(); }
  var room = req.query.room;
  if( !room ){ room = settings.defaultroom; }
  res.render( 'client', { name: name, room: room } );
});

app.get( '/view', function( req, res ){
  var room = req.query.room;
  if( !room ){ room = ''; /*settings.defaultroom;*/ }
  var columns = req.query.columns;
  if( columns ){
    columns = parseInt( columns );
  }else{
    columns = settings.defaultcolumns;
  }
  res.render( 'view', { room: room, columns: columns } );
});

app.post( '/broadcast', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var room = req.body.room;
  if( !room ){ room = settings.defaultroom; }
  if( view_sockets[room] ){
    var msg = req.body;
    view_sockets[room].socket.json.broadcast.emit( 'broadcast', msg );

    res.write( JSON.stringify( { status: true }, 2, null ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: "no room found for " + room + "." }, 2, null ) );
    res.end();
  }
});

app.post( '/emit/:socket_id', function( req, res ){
  //. https://www.marineroad.com/staff-blog/8540.html
  res.contentType( 'application/json; charset=utf-8' );
  var socket_id = req.params.socket_id;
  var room = req.body.room;
  if( !room ){ room = settings.defaultroom; }
  if( view_sockets[room] ){
    if( socket_id ){
      var msg = req.body;

      //. to() でソケットを特定しているつもりだけど、うまく送れない
      //var o = view_sockets[room].socket.json.to(socket_id).emit( 'notify', msg );  //. クライアントに emit が通知されない

      //. 仕方ないので broadcast で送る。Client 側で type(emit) と socket_id を比較して処理する
      msg.socket_id = socket_id;
      view_sockets[room].socket.json.broadcast.emit( 'broadcast', msg );

      res.write( JSON.stringify( { status: true }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: "no socket_id specified." }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: "no room found for " + room + "." }, 2, null ) );
    res.end();
  }
});


//. socket.io
var view_sockets = {};
io.sockets.on( 'connection', function( socket ){
  //console.log( 'connected.' );

  //. 一覧画面の初期化時
  socket.on( 'init_view', function( msg ){
    //console.log( 'init_view' );
    var room = msg.room ? msg.room : settings.defaultroom;

    var ts = ( new Date() ).getTime();
    if( !view_sockets[room] ){
      view_sockets[room] = { socket: socket, timestamp: ts };
    }else{
      //. expired の判断はしないことにする
      //if( view_sockets[room].timestamp + ( 10 * 60 * 60 * 1000 ) < ts ){ //. 10 hours
        view_sockets[room] = { socket: socket, timestamp: ts };
      //}else{
      //  console.log( 'Room: "' + room + '" is not expired yet.' );
      //}
    }
    //console.log( view_socket );
  });

  //. 初期化時（ロード後の最初の resized 時）
  socket.on( 'init_client', function( msg ){
    //. msg 内の情報を使って初期化
    //console.log( 'init_client' );
    msg.socket_id = socket.id;
    //console.log( msg );

    var room = msg.room ? msg.room : settings.defaultroom;

    if( view_sockets[room] ){
      view_sockets[room].socket.json.emit( 'init_client_view', msg );
    }
  });

  //. 描画イベント時（ウェイトをかけるべき？）
  socket.on( 'msg_client', function( msg ){
    //. evt 内の情報を使って描画
    //console.log( msg );
    //console.log( 'image_client' );
    msg.socket_id = socket.id;
    //console.log( msg );

    var room = msg.room ? msg.room : settings.defaultroom;

    if( view_sockets[room] ){
      view_sockets[room].socket.json.emit( 'msg_client_view', msg );
    }
  });
});


function timestamp2datetime( ts ){
  if( ts ){
    var dt = new Date( ts );
    var yyyy = dt.getFullYear();
    var mm = dt.getMonth() + 1;
    var dd = dt.getDate();
    var hh = dt.getHours();
    var nn = dt.getMinutes();
    var ss = dt.getSeconds();
    var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd
      + ' ' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;
    return datetime;
  }else{
    return "";
  }
}


var port = process.env.PORT || 8080;
http.listen( port );
console.log( "server starting on " + port + " ..." );
