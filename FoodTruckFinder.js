#!/usr/bin/env node
const request = require('request');
const columnify = require('columnify');
const program = require('commander');
const redis = require('redis');
const REDIS_PORT  = process.env.REDIS_PORT;
const client = redis.createClient(REDIS_PORT);


class FoodTruckFinder {

    init(){
        program.option('-i, --integer <n>', 'An integer argument for page num', parseInt).parse(process.argv);

        if(program && program.integer >=0) {
            client.setex('pageNum', parseInt((new Date().setHours(23, 59, 59, 999)-new Date())/1000), program.integer,() => {
                this.getData();
            });
        } else {
            this. checkPageNumExist();
        }
    }

    getData() {
        client.get('pageNum',(err,data) => {
            const key = 'foodtruck:' + data;
            client.exists(key, (err,reply) => {
                if(reply === 1) {
                    this.getDataFromCache();
                } else {
                    this.getDataFromRemote();
                }
            })
        })
    }

    checkPageNumExist() {
        client.exists('pageNum',(err,reply) => {
            if(reply === 1) {
                this.getData();
            } else {
                client.setex('pageNum', parseInt((new Date().setHours(23, 59, 59, 999)-new Date())/1000), 0, () => {
                    this.getData();
                });
            }
        })
    }

     getDataFromCache(key){
        client.get(key, (err, data) => {
            const currentPageNum = parseInt(key.split(':')[1]);
            FoodTruckFinder.increasePageNum(currentPageNum);
            this.printResult(data);
        });
    }

     getDataFromRemote(key){
        const currentPageNum = parseInt(key.split(':')[1]);
        const curDate = new Date();
        const curDayofWeek = curDate.getDay();
        const query = 'SELECT applicant, location WHERE dayorder = ' + curDayofWeek +
            ' ORDER By applicant ASC LIMIT 10 OFFSET '+ currentPageNum * 10;
        const url = 'http://data.sfgov.org/resource/bbb8-hzi6.json?$query='+ query;
        request({
            headers: {
                'Accept': 'application/json',
                'X-App-Token': 'B7uOjiwjqOVJ6wqqOkzh68V8o'
            },
            uri: url,
            method: 'GET'
        },  (err, res, body) => {
            //save data to cache
            client.setex(key, parseInt((new Date().setHours(23, 59, 59, 999)-new Date())/1000), body);
            FoodTruckFinder.increasePageNum(currentPageNum);
            this.printResult(body);
        });
    }

     static increasePageNum(currentPageNum){
        currentPageNum++;
        client.setex('pageNum', parseInt((new Date().setHours(23, 59, 59, 999)-new Date())/1000), currentPageNum);
    }

    printResult(data) {
        const resArr = JSON.parse(data);
        if(resArr && resArr.length>0){
            console.log(columnify(resArr));
        }else{
            console.log('No more data...');
        }
        process.exit(0);
    }

}
