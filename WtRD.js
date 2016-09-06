'use strict';
console.log("In WTRD");
let _=require("lodash");
/*
  WSE: With Side Effects
  Util has only Pure functions
*/
function safeGetWSE(obj){
  let entry1=(new Date()).toISOString();
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

            if ((end-start) !== config.datalen) {
              config.datalen=end-start;
              this.config(config);
            }
          
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
              case emptyChk1 && moveleft && !moveright: 
                downRng = Util.shifter(availableRng, -config.bufferlen);break;
          
              case emptyChk1 && !moveleft && moveright: 
                downRng = Util.shifter(availableRng, +config.bufferlen);break;
          
              case emptyChk1 && !moveleft && !moveright: 
                downRng = {};break;
          
              case !emptyChk1: 
                downRng = {
                  start: start - config.bufferlen,
                  end: end + config.bufferlen
                };break;
              default: throw Error("wtrd Logic Error: Should not have happened");
            } 
          
          
            if (!_.isEmpty(downRng)) {
              //downRng only has outer right now, will add except part now:
              if (!Util.checkRng(downRng) || !Util.checkRng(sourceRng)) throw Error("wtrd Logic Error: Bad input to rangeFix");
          
              downRng = Util.rangeFix(downRng, sourceRng);
              let downObj = Util.breakRng(downRng)[0];
              let except = _.intersection(downObj, availableIndices);
          
              switch(_.isEqual(except, downObj)){
                case true: downRng = {};break;//Happens in edge case only
                case false: downRng = Util.makeRng([downObj, except]);break;
              }
            }
          
            
            let emptyChk2=_.isEmpty(downRng);
          
            switch(true){
              case emptyChk1 && emptyChk2: //CASE 0: sync up, no fetch
                retval= getUpFromAvailWSE(this,obj);break;
          
              case emptyChk1 && !emptyChk2://CASE 1: sync up, fetch
                this.downRng(downRng);
                this.__fetch2__.push(Promise.resolve(this.downAsyncFn()(downRng)).then(d=>{
                  updateAvailWSE(this,d);
                }));
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


    return dsw.down(d).availableData(availableData)
              .availableRng(Util.makeRng([availableData.map(d=>d.index)]))
  }
  
  function getUpFromAvailWSE(dsw,obj){
    if(_.isEmpty(dsw.availableData())) return _.noop();

    if(!_.isEmpty(_.difference(Util.breakRng(obj)[0],dsw.availableData().map(d=>d.index)))) 
      throw Error("wtrd Logic error: Asked not available in mem");

    dsw.upRng(obj);//For next/previous
    
    return _(dsw.availableData()).filter(d=>{
      return d.index>=obj.start && d.index<obj.end;
    }).map(d=>{
      return d.value;
    }).value();
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

    let retval, start = rng.start,
      end = rng.end,
      len = end - start;
    if (len > range.end - range.start) len = range.end - range.start;

    if (rng.start < range.start) {
      start = 0, end = len;
    }

    if (rng.end >= range.end) {
      end = range.end, start = end - len;
    }

    return {
      start: start,
      end: end
    };
  },
  shifter: (rng, n) => {
    return {
      start: rng.start + n,
      end: rng.end + n
    };
  }
}

class wtrd{
  constructor(){
    this.get=safeGetWSE;
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
      if (!(_.isNumber(config.datalen) &&
        _.isNumber(config.bufferlen) && _.isNumber(config.bufferCursor) &&
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
  
  down(){
    if(arguments.length){
      this.__down__=arguments[0];
      return this;
    }else return this.__down__;
  }
  upRng(){
    if(arguments.length){
      if(!Util.checkRng(arguments[0]))
        throw Error("wtrd Logic Error: Bad range object");

      this.__upRng__=arguments[0];
      return this;
    }else return this.__upRng__;
  }
  downRng(){
    if(arguments.length){
      if(!Util.checkRng(arguments[0]))
        throw Error("wtrd Logic Error: Bad range object");

      this.__downRng__=arguments[0];
      return this;
    }else return this.__downRng__;
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
module.exports={wtrd:wtrd,
                Util:Util};
