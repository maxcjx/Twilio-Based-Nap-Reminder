const http = require('http');
const twilio = require('twilio')
const client = new twilio('AC316220161af00ea104c3a384b39751fa', '0bb4332805f87c56e42d345ba09cac42')
const cronJob = require('cron').CronJob

const express = require('express');
const bodyParser = require('body-parser');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

const numbers = ["+18589439846", "+18586146666", "+13127884246", "temp2"];
var stageNums = new Array(4);
var startTimes = new Array(4);
var endTimes = new Array(4);
var activities = new Array(4);
var preSchedule = new Array(4);
var napped = new Array(4);

for(var i = 0; i < 4; i++) {
  stageNums[i] = 0;
  napped[i] = false;
  preSchedule[i] = -1;
  startTimes[i] = [];
  endTimes[i] = [];
  activities[i] = [];
}

function morningMessage(number) {
  var textJob = new cronJob( '30 08 * * *', function(){
   	 client.messages.create( { to:number, from:'+18583483347', 
      body:'Good morning! Do you have any hard schedule between 12-4PM today that you definitely cannot have a 30min nap? Reply 1 for yes, 0 for no.' }, 
      function( err, data ) {});
   }, null, true);
}

function isNormalInteger(str) {
  var n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

function noConflictWithActivity(uid, timeStamp) {
  var startTime = startTimes[uid];
  var endTime = endTimes[uid];
  for(var i = 0; i < startTime.length; i++) {
    if(timeStamp >= startTime[i] && timeStamp <= endTime[i]) return false;
  }
  return true;
}

function checkTimeAvailability(uid, timeStamp) {
  if(240-timeStamp < 40) return 2; // no time to nap today
  if(noConflictWithActivity(uid, timeStamp)) {
    const nextStartTime = getNextStartTime(uid, timeStamp);
    if(nextStartTime == -1 || (nextStartTime-timeStamp) > 40) return 0; // can send notification 10min after

    const nextEndTime = getNextEndTime(uid, timeStamp);
    const temp = checkTimeAvailability(uid, nextEndTime+1);
    if(temp == 2) return 2;
    else return 1;
  }
  else {
    const nextEndTime = getNextEndTime(uid, timeStamp);
    const temp = checkTimeAvailability(uid, nextEndTime+1);
    if(temp == 2) return 2;
    else return 1;
  }
}

function getNextStartTime(uid, timeStamp) {
  var startTime = startTimes[uid];
  var res = -1;
  for(var i = 0; i < startTime.length; i++) {
    const curr = startTime[i];
    if(curr < timeStamp) continue;
    if(res == -1 || res > curr) res = curr;
  }
  return res;
}

function getNextEndTime(uid, timeStamp) {
  var endTime = endTimes[uid];
  var res = -1;
  for(var i = 0; i < endTime.length; i++) {
    const curr = endTime[i];
    if(curr < timeStamp) continue;
    if(res == -1 || res > curr) res = curr;
  }
  return res;
}

function convertToTimeStr(timeStamp) {
  var nextHH = Math.floor(timeStamp / 60)+12;
  var nextMM = timeStamp % 60;

  var strHH = nextHH.toString();
  var strMM = nextMM.toString();
  if(nextMM < 10) strMM = '0'+strMM;

  return strMM + ' ' + strHH + ' * * *';
}

function getUID(number) {
  for(var i = 0; i < numbers.length; i++) {
    if(number == numbers[i]) return i;
  }
  return 0;
}

app.post('/sms', function (req, res) {
  const resp = new MessagingResponse();
  const body = req.body.Body;
  const number = req.body.From;
  const uid = getUID(number);
  var stageNum = stageNums[uid];
  console.log("message from " + number);
  console.log("message body " + body);
  console.log(stageNum);
  switch (stageNum) {
    case 0:    
      if(body == "1") {
        resp.message('When does it start? e.g. [1:30]');
        stageNums[uid] = stageNum+1;
      }
      else if(body == "0") {
        resp.message('Do not forget to bring small pillow or eye mask if you have one. Have a nice day!');
        stageNums[uid] = 4;
      }
      else {
        resp.message('Please reply either 1 or 0.');
      }
      break;
    case 1:
      var arr = body.split(":")
      if(arr.length != 2) {
        resp.message('Please enter the time with format [hh:mm] where hh is between 12 and 4 and mm is between 0 and 59')
        break;
      }

      if(arr[0].charAt(0) == '0') arr[0] = arr[0].substring(1, arr[0].length);
      if(arr[1].charAt(0) == '0') arr[1] = arr[1].substring(1, arr[1].length);

      if(!isNormalInteger(arr[0]) || !isNormalInteger(arr[1])) {
        resp.message('Please enter the time with format [hh:mm] where hh is between 12 and 4 and mm is between 0 and 59')
      }
      else {
        var hh = parseInt(arr[0]);
        var mm = parseInt(arr[1]);
        if(hh != 12 && hh > 4) {
          resp.message('Please enter the time with format [hh:mm] where hh is between 12 and 4 and mm is between 0 and 59')
        }
        else if(mm > 59) {
          resp.message('Please enter the time with format [hh:mm] where hh is between 12 and 4 and mm is between 0 and 59')
        }
        else {
          if(hh == 12) hh = 0;
          startTimes[uid].push(hh*60+mm);
          resp.message('Alright! When will it end? e.g. [3:00]')
          stageNums[uid] = stageNum+1;
        }
      }
      break;
    case 2:
      var arr = body.split(":")
      if(arr.length != 2) {
        resp.message('Please enter the time with format [hh:mm] where hh is between 12 and 4 and mm is between 0 and 59')
        break;
      }

      if(arr[0].charAt(0) == '0') arr[0] = arr[0].substring(1, arr[0].length);
      if(arr[1].charAt(0) == '0') arr[1] = arr[1].substring(1, arr[1].length);

      if(!isNormalInteger(arr[0]) || !isNormalInteger(arr[1])) {
        resp.message('Please enter the time with format [hh:mm] where hh is between 12 and 4 and mm is between 0 and 59')
      }
      else {
        var hh = parseInt(arr[0]);
        var mm = parseInt(arr[1]);
        console.log(hh);
        console.log(mm);
        if(hh != 12 && hh > 4) {
          resp.message('Please enter the time with format [hh:mm] where hh is between 12 and 4 and mm is between 0 and 59')
        }
        else if(mm > 59) {
          resp.message('Please enter the time with format [hh:mm] where hh is between 12 and 4 and mm is between 0 and 59')
        }
        else {
          if(hh == 12) hh = 0;
          endTimes[uid].push(hh*60+mm);
          resp.message('Got it! Can you describe the activity in short?')
          stageNums[uid] = stageNum+1;
        }
      }
      break;
    case 3:
      activities[uid].push(body);
      resp.message('Ok! Any other activities? Reply 1 for yes, 0 for no.')
      stageNums[uid] = 0;
      break;
    case 4:
      var d = new Date(); 
      hh = d.getHours(); 
      mm = d.getMinutes(); 
      if(hh < 12 || hh >= 16) break;
      hh = hh - 12;
      var timeStamp = hh*60+mm;
      console.log("timestamp " + timeStamp);
      if(body == "1") {
        resp.message('Great! Take a 30min nap! Here are some links to white noise. Might be helpful :) https://open.spotify.com/track/4l8OMZI8nrTQYwOLv2mvVO');
        napped[uid] = true;

        var nextTimeStamp = timeStamp + 30;
        const strTime = convertToTimeStr(nextTimeStamp);
        console.log(strTime);
        var tempJob = new cronJob( strTime, function(){
          client.messages.create( { to: number, from:'+18583483347', 
          body:'Did you nap? How was it?' }, 
          function( err, data ) {});
          }, null, true);
        stageNums[uid] = 5;
      }
      else if(body == "0") {
        var temp = checkTimeAvailability(0, timeStamp);

        // still have time to nap
        if(temp == 0) {
          resp.message('Sure! Will remind you 10 minutes later.');
        }

        // have time to nap after next activity
        else if(temp == 1) {
          resp.message('Alright. There is no time to nap before your next activity. I will remind you later.')
        }

        // no time to nap today
        else {
          resp.message('Unfortunately, we do not have time to nap today. Please do not nap any time later, because it will affect your sleep cycle!')
          napped[uid] = true;
          stageNums[uid] = 5;
        }
        
      }
      else {
        resp.message('Please reply either 1 or 0.');
        break;
      }
      preSchedule[uid] = timeStamp;

      break;
    case 5:
      resp.message('End of today.');
      break;
  }

  res.writeHead(200, {
    'Content-Type':'text/xml'
  });
  res.end(resp.toString());
});

app.get('/', function (req, res) {
  res.send('Hello World!');
});

const port = 8080;
http.createServer(app).listen(port, () => {
  console.log('Express server listening on port 8080');

  for(var i = 0; i < 3; i++) {
    morningMessage(numbers[i]);
  }

  setInterval(function() { looping() }, 10000);
});

function looping() {
  var d = new Date(); 
  hh = d.getHours(); 
  mm = d.getMinutes();
  if(hh >= 12 && hh < 16) {
    hh = hh - 12;
    var timeStamp = hh*60+mm;
    for(var i = 0; i < 3; i++) {

      if(stageNums[i] != 4) continue;

      if(napped[i] || !noConflictWithActivity(i, timeStamp) || (240-timeStamp) < 30) continue;

      // still in cold down
      if(preSchedule[i] != -1 && timeStamp-preSchedule[i] < 10) continue;

      var nextStartTime = getNextStartTime(i, timeStamp);

      var index = 0;
      for(var j = 0; j < startTimes[i].length; j++) {
        if(startTimes[i][j] == nextStartTime) {
          index = j;
          break;
        }
      }

      // no time to nap before next activity
      if(nextStartTime != -1 && nextStartTime-timeStamp < 30) continue;

      if(nextStartTime == -1) {
        client.messages.create( { to:numbers[i], from:'+18583483347', 
        body:'Good afternoon! You do not have any hard schedule afterwards. Why not take a nap? Reply 1 for yes, 0 for remind me later.'}, 
        function( err, data ) {});
      }

      else {
        client.messages.create( { to:numbers[i], from:'+18583483347', 
        body:'Good afternoon! There is ' + (nextStartTime-timeStamp) + ' minutes before your next activity, which is ' + activities[i][index] + ' . Why not take a nap? Reply 1 for yes, 0 for remind me later.' }, 
        function( err, data ) {});
      }

      preSchedule[i] = timeStamp;
    }
  }
}




