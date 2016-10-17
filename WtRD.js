/*  
    Using UMD template https://github.com/umdjs/umd/blob/master/templates/returnExports.js
*/
'use strict';

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['lodash'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('lodash'));
    } else {
        // Browser globals (root is window)
        root.wtrd = factory(root._);
    }
}(this,realAction));

function realAction(_){
/*
  WSE: With Side Effects
  Util has only Pure functions
*/
function safeGetWSE(obj){
  /* 
    fetch1,fetch2 are VERY IMPORTANT for FORCED SERIALIZATION
    - fetch1 keeps track of consecutive requests
      - These must be chained, FORCED SERIALIZATION: Future option: take latest
      - Inside a fetch1 promise, check if all fetch2s are resolved
    - fetch2 keeps track of inner requests 
      - If there is a third nesting layer, these will have to be chained too
      - Current: simple Push, no chaining
  */
  this.__fetch1__=this.__fetch1__ || [];
  this.__fetch2__=this.__fetch2__ || [];

  let latestProm=Promise.resolve(_.last(this.__fetch1__)).then(()=>{
      return Promise.all(this.__fetch2__).then(()=>{
                      
            let availableData = this.availableData() || [],
                availableIndices=availableData.map(d=>d.index) || [],
                availableRng=Util.makeRng([availableIndices]) || {},
                config = this.config(),
                dataSize = this.dataSize();

                this.availableOldRng(availableRng)
                  .down([])
                  .downRng({});

            let sourceRng = {
              start: 0,
              end: dataSize
            };
            
            if(_.isNumber(obj)){ 
              obj=Util.shifter(this.upRng(),obj);
            }

            if (!Util.checkRng(obj) || !Util.checkRng(sourceRng))
             throw Error("wtrd INPUT Error: Bad input to rangeFix");
          
            obj = Util.rangeFix(obj, sourceRng); //FIRST DATA CHECK & EDGEFIX
            let start = obj.start,
              end = obj.end,
              objexplode = Util.breakRng(obj),
              retval,downRng;
          
            if (!_.isEmpty(objexplode[1])) throw Error("wtrd INPUT Error: Bad input to .get");
          
            let asked = objexplode[0];
            let emptyChk1=_.isEmpty(_.difference(asked, availableIndices));
            let moveleft,moveright;
          
            if (emptyChk1) {
              // That is data available and asked is subset of avail
              let left,right;
              //limit exceeded - fetch right or left
              left = _.slice(availableIndices, 0, config.bufferCursor);
              right = _.slice(availableIndices,
                  availableIndices.length - config.bufferCursor,
                  availableIndices.length);
          
              moveleft=!_.isEmpty(_.intersection(asked, left));
              moveright=!_.isEmpty(_.intersection(asked, right));
            }
          
            switch(true){
              case emptyChk1 && !moveleft && !moveright: 
                downRng = {};break;
              default: //not handling left right logic anymore
                downRng = {
                  start: start - config.bufferlen,
                  end: end + config.bufferlen
                };
              //downRng only has outer right now, will add except part now:
              if (!Util.checkRng(downRng) || !Util.checkRng(sourceRng)) throw Error("wtrd Logic Error: Bad input to rangeFix");
          
              downRng = Util.rangeFix(downRng, sourceRng);
              let downObj = Util.breakRng(downRng)[0];
              let except = _.intersection(downObj, availableIndices);
          
              switch(_.isEqual(except, downObj)){
                case true: downRng = {};break;//Happens in edge case only
                case false: downRng = Util.makeRng([downObj, except]);break;
              };
                break;
             } 
          
            
            let emptyChk2=_.isEmpty(downRng);
          
            switch(true){
              case emptyChk1 && emptyChk2: //CASE 0: sync up, no fetch
                retval= getUpFromAvailWSE(this,obj);break;
          
              case emptyChk1 && !emptyChk2://CASE 1: sync up, fetch
                this.downRng(downRng);
                let pushval=Promise.resolve(this.downAsyncFn()(downRng)).then(d=>{
                  updateAvailWSE(this,d);
                  if(!(this.upRng().start>=this.availableRng().start && this.upRng().end<=this.availableRng().end)){
                    throw Error("wtrd Logic Error:This should not happen")
                  }
                }).then(()=>{
                  this.events.publish('asyncfetch', this.availableRng());
                });
                //this.__fetch2__.push(pushval);
                retval= getUpFromAvailWSE(this,obj);break;
              
              case !emptyChk1 && emptyChk2://CASE ERROR: async up, no fetch
                throw Error("wtrd Logic Error: This block should never execute");break;
              
              case !emptyChk1 && !emptyChk2://CASE 2: async up, fetch
                this.downRng(downRng);
                retval=Promise.resolve(this.downAsyncFn()(downRng)).then(d=>{
                  updateAvailWSE(this,d);
                  return getUpFromAvailWSE(this,obj);//POST-update, so has to use this
                });   
                this.__fetch2__.push(retval); 
                break;
            }
            //Can be replaced by PUSH
            return retval;
            });
    });
  
  return chainPromiseWSE(this.__fetch1__,latestProm);

  
  function chainPromiseWSE(fetchArr,latestProm){ //WSE=With Side Effects
    fetchArr.push(Promise.resolve(_.last(fetchArr)).then(()=>{ 
      return latestProm;
    }));

    return _.last(fetchArr);
  }

  function updateAvailWSE(dsw,d){
    if(!(_.has(d,'asked') && _.has(d,'value') &&  Util.checkRng(d.asked)))
      throw Error("wtrd Logic Error: Bad input to updateAvailWSE");

    let availableData=dsw.availableData() || [];
    //Lift D:
    let askedRng=Util.breakRng(d.asked);
    let indices=_.difference(askedRng[0],askedRng[1]);
    
    if(indices.length!==d.value.length)
      throw Error("Source Logic Error: Returned data from source doesn't match asked range");

    let newD=d.value.map((d1,i,d)=>{
      return {index:indices[i],value:d1};
    });

    //merge d with availableData
    availableData = _.unionBy(
      availableData,
      newD, d => {
        return d.index;
      });

    availableData = _.sortBy(
      availableData, d => {
        return d.index;
      });

    availableData = _.filter(availableData,
      d1=>{
        return d1.index >= d.asked.start && d1.index < d.asked.end;
      });
    dsw.down(d).availableData(availableData)
              .availableRng(Util.makeRng([availableData.map(d=>d.index)]))
    dsw.events.publish('availchanged',dsw.availableRng());

    return dsw.availableRng();
  }
  
  function getUpFromAvailWSE(dsw,obj){
    if(_.isEmpty(dsw.availableData())) return _.noop();

    if(!_.isEmpty(_.difference(Util.breakRng(obj)[0],dsw.availableData().map(d=>d.index)))) 
      throw Error("wtrd Logic error: Asked not available in mem");

    dsw.upRng(obj);//For next/previous
    let up=_(dsw.availableData()).filter(d=>{
      return d.index>=obj.start && d.index<obj.end;
    }).map(d=>{
      return d.value;
    }).value();
    
    dsw.up(up).events.publish('upchanged', up);
    return up;
  }
}

let Util = {//Pure Functions
  checkRng: (rng) => {
    return _.isObject(rng) && (_.isEmpty(rng) || (_.isEmpty(_.difference(_.keys(rng), ["start", "end", "except"])) 
      && _.isNumber(rng.start) && _.isNumber(rng.end) && rng.start <= rng.end && 
      (_.has(rng, 'except') ? Util.checkRng(rng.except) : true)));
  },
  makeRng: (d) => {
    let mi = d[0],
      ei = d[1];
    if (_.isEmpty(mi)) return _.noop();
    //mi and ei are ranges.
    let obj = {};
    obj.start = _.head(mi);
    obj.end = _.last(mi) + 1;

    if (!_.isEmpty(ei)) {
      obj.except = Util.makeRng([ei]);
    }
    return obj;
  },
  breakRng: (rng) => {
    let askedI = _.range(rng.start, rng.end);
    let exceptI = _.has(rng, 'except') ? _.range(rng.except.start, rng.except.end) : [];
    return [askedI, exceptI];
  },
  rangeFix: (rng, range) => {
    let start,end,rstart,rend;
    if(_.isArray(rng) && _.isArray(range))
    start=rng[0],end=rng[1], rstart=range[0],rend=range[1];
  else if(_.isObject(rng) && _.isObject(range))
    start=rng.start,end=rng.end,rstart=range.start,rend=range.end;
    let retval,
      len = end - start;
    if (len > rend-rstart) len = rend-rstart;

    if (start<rstart) {
      start = rstart, end = start+len;
    }

    if (end > rend) {
      end = rend, start = end - len;
    }
  
  if(_.isArray(rng))
    return [start,end];
  else if(_.isObject(rng))
    return {
          start: start,
          end: end
        };
  return rng;
  },
  shifter: (rng, n) => {
    return {
      start: rng.start + n,
      end: rng.end + n
    };
  },
  rngToArr: (rng)=>{
    return [rng.start,rng.end];
  },

  arrToRng: (arr)=>{
    return {start:arr[0],end:arr[1]};
  },

  lodashtoD3Arr:(arr)=>{
    return [arr[0],arr[1]-1];
  },

  D3toLodashArr: (arr)=>{
    return [arr[0],arr[1]+1];
  }
}



class wtrd{
  constructor(){
    this.get=safeGetWSE;
    this.events=/*Tiny pubsub module */
    (function(){
      var topics = {};
      var hOP = topics.hasOwnProperty;

      return {
        subscribe: function(topic, listener) {
          // Create the topic's object if not yet created
          if(!hOP.call(topics, topic)) topics[topic] = [];

          // Add the listener to queue
          var index = topics[topic].push(listener) -1;

          // Provide handle back for removal of topic
          return {
            remove: function() {
              delete topics[topic][index];
            }
          };
        },
        publish: function(topic, info) {
          // If the topic doesn't exist, or there's no listeners in queue, just leave
          if(!hOP.call(topics, topic)) return;

          // Cycle through topics queue, fire!
          topics[topic].forEach(function(item) {
              item(info != undefined ? info : {});
          });
        }
      };
    })();
    /*Tiny pubsub module */
    return this;
  }
  previous(){
    return this.get(-this.config().delta);
  }
  next(){
    return this.get(+this.config().delta);
  }
  config(){
    if(arguments.length){
      let config=arguments[0];
      if (!(_.isNumber(config.bufferlen) && _.isNumber(config.bufferCursor) &&
        _.isNumber(config.delta)
      )) throw Error("wtrd INPUT Error: Bad THIS");

      this.__config__=config; 
      return this;
    }else return this.__config__;
  }

  dataSize(){
    if(arguments.length){
      if (!_.isNumber(arguments[0])) throw Error("wtrd INPUT Error: Bad THIS");

      this.__dataSize__=arguments[0];
      this.events.publish("dataSizeChanged",this.__dataSize__);
      return this;
    }else return this.__dataSize__;
  }
  downAsyncFn(){
    if(arguments.length){
      if(!_.isFunction(arguments[0]))
         throw Error("wtrd INPUT Error: Bad THIS");

      this.__downAsyncFn__=arguments[0];
      return this;
    }else return this.__downAsyncFn__;
  }
  
  up(){
    if(arguments.length){
      this.__up__=arguments[0];
      return this;
    }else return this.__up__;
  }

  upRng(){
    if(arguments.length){
      if(!Util.checkRng(arguments[0]))
        throw Error("wtrd Logic Error: Bad range object");

      this.__upRng__=arguments[0];
      return this;
    }else return this.__upRng__;
  }

  down(){
    if(arguments.length){
      this.__down__=arguments[0];
      return this;
    }else return this.__down__;
  }

  downRng(){
    if(arguments.length){
      if(!Util.checkRng(arguments[0]))
        throw Error("wtrd Logic Error: Bad range object");

      this.__downRng__=arguments[0];
      return this;
    }else return this.__downRng__;
  }

  availableData(){
    if(arguments.length){

      if (!_.isEmpty(_.filter(arguments[0], (d, i, arr) => {
        if (i === 0 || (arr[i].index - arr[i - 1].index) === 1) {
          return false
        } else return true
      })
      )){ 
        throw Error("wtrd Logic Error: Available Data doesnt contain sequence data");
      };

      this.__availableData__=arguments[0];
      return this;
    }else return this.__availableData__;
  }  
  availableRng(){
    if(arguments.length){
      if(!Util.checkRng(arguments[0]))
        throw Error("wtrd Logic Error: Bad range object");

      this.__availableRng__=arguments[0];
      return this;
    }else return this.__availableRng__;
  }
  
  availableOldRng(){
    if(arguments.length){
      if(!Util.checkRng(arguments[0]))
        throw Error("wtrd Logic Error: Bad range object");

      this.__availableOldRng__=arguments[0];
      return this;
    }else return this.__availableOldRng__;
  }
}
return {wtrd:wtrd,Util:Util};
}