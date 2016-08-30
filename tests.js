    'use strict';
    console.clear();
    let _ = require("lodash");
    let test = require("tape");

    let DataSourceWindow = require("./WtRD").DataSourceWindow;
    let ut = require("./WtRD.js").Util;

    let source = {
      get: (downRng) => {
        let broken = ut.breakRng(downRng);
        return {
          asked: downRng,
          value: _.difference(broken[0],
            broken[1]).map(d => ({
            valueInner: "&&" + d + "&&"
          }))
        }
      },
      getIndexOf: (item) => { //Needed for test only
        return _.toNumber(_.trim(item.valueInner, "& "));
      }
    };


    let DSW = new DataSourceWindow().config({
      datalen: 10,
      /* Start absolute, will change when requests change */
      bufferlen: 10,
      /* On both sides of data */
      bufferCursor: 4,
      /* fraction of Buffer */
      delta: 1,
      /* Convenience for Next/Prev */
      /*bufferLoadMult:1, /* fraction of buffer */
    })
    .downAsyncFn((downRng) => {

      return new Promise((resolve, reject) => {

        setTimeout(() => {
          resolve(source.get(downRng));
        }, 0);

      });

    })
    .dataSize(96);

    let debug = [
      [null, null, null]
    ];

    function printer(t, obj, result, msg, downStatus) {
      /*
      Up tests 
      - up should be same as requested(except edge case)
      - up should be subset of availableData
      - upRng should be subset of __availableRng__        
      */
      let lastD = _.last(debug);

      if (!_.isEmpty(debug)) {
        switch (true) {
          case _.isEmpty(lastD[0]) && _.isEmpty(lastD[2]):
            t.assert(_.isEmpty(lastD[2]), "---case 0/INIT: avail not updated---");
            break;
          case _.isEqual(lastD[0], lastD[1]) && lastD[2] === 2:
            t.assert(_.isEqual(DSW.availableOldRng(), lastD[0]),
              "---case 2: avail updated pre-return---");
            break;
          case !_.isEqual(lastD[0], lastD[1]) && lastD[2] === 1:
            t.assert(_.isEqual(DSW.availableOldRng(), lastD[0]),
              "---case 1:  POST-RETURN UPDATE---");
            break;
          default:
            t.fail("Something went wrong in debug");
        }
        debug.pop();
      }

      if (downStatus === 1)
        debug.push([_.omit(DSW.downRng(), 'except'), DSW.availableRng(), downStatus]);

      console.log("\n");
      console.log("START " + msg);
      let indices = result.map(d => source.getIndexOf(d));

      if (_.isEqual(indices, _.range(obj.start, obj.end))) {
        t.pass(" - UP");
        /*
        console.log("asked ",obj);
        console.log("old   ",DSW.__availableOldRng__);
        console.log("down  ",DSW.__downRng__);
        console.log("new   ",DSW.__availableRng__);
        console.log("up    ",Util.makeRng([result]));
        */
      } else {
        t.fail(" - UP");
      }

      /*
      Down tests

      - downStatus 0: down and fetch should be empty
      - downStatus 2: down should be valid and fetch should be a resolved Promise:
        - down.asked and down.value should be set
        - diff(asked.main-except)===down.value
        - __availableRng__ should be same as down outer
      - downStatus 1: down should be empty and fetch should be an unresolved Promise
      */

      switch (downStatus) {
        case 0:
          t.assert(_.isEmpty(DSW.down()) && _.isEmpty(DSW.downRng()), " - case 0");
          break;
        case 1:
          t.assert(_.isEmpty(DSW.down()) && !_.isEmpty(DSW.downRng()), " - case 1: basic check");
          t.assert(_.isEqual(DSW.availableOldRng(), DSW.availableRng()), " - case 1: avail WILL be updated");
          break;
        case 2:
          t.assert(!_.isEmpty(DSW.down()) && !_.isEmpty(DSW.downRng()), " - case 2: basic check");
          t.assert(!_.isEqual(DSW.availableOldRng(), DSW.availableRng()), " - case 2: avail updated");

          break;
        default:
          t.fail("Unexpected downStatus " + downStatus);
      }
      console.log("END");
    }
        
    test("###########          Series Tests - INIT MID          ###########", t => {
      DSW.__availableData__=[];
      debug=[[null,null,null]];
      let now1=performance.now();

      Promise.resolve(DSW.get({start:45,end:55}))
      .then(t1 => {
        printer(t, {start:45,end:55}, t1, "Init fetch", 2);
        return DSW.get({start:50,end:60});
      }).then(t1 => {
        printer(t, {start:50,end:60}, t1, "Right within Trimmed", 0);
        return DSW.get({start:52,end:62})
      }).then(t1 => {
        printer(t, {start:52,end:62}, t1, "Right outside Trimmed", 1);
        return DSW.get({start:49,end:59});
      }).then(t1 => {
        printer(t, {start:49,end:59}, t1, "Left within Trimmed", 0);
        return DSW.get({start:48,end:58});
      }).then(t1 => {
        printer(t, {start:48,end:58}, t1, "Left Outside Trimmed", 1);
        return DSW.get({start:31,end:41});
      }).then(t1 => {
        printer(t, {start:31,end:41}, t1, "Left Outside Avail", 2);
        return DSW.get({start:55,end:65});
      }).then(t1 => {
        printer(t, {start:55,end:65}, t1, "Right Outside Avail", 2);
        return DSW.get({start:44,end:80});
      }).then(t1 => {
        printer(t, {start:44,end:80}, t1, "Resize case", 2);
        return DSW.get({start:-5,end:100});
      }).then(t1 => {
        printer(t, {start:0,end:96}, t1, "OUT OF RANGE CASE", 2);
        t.end();
        console.log("\n");
        console.log("Total Time: ",performance.now()-now1);
      })

    });


    test("###########          Series Tests - INIT END          ###########", t => {
      DSW.__availableData__=null;
      debug=[[null,null,null]];
      let now1=performance.now();
      Promise.resolve(DSW.get({start:86,end:96})).then(t1 => {
        printer(t, {start:86,end:96}, t1, "Init fetch", 2);
        return DSW.get({start:87,end:97});
      }).then(t2 => {
        printer(t, {start:86,end:96}, t2, "EDGE CASE - Right Outside Avail ", 0);
        return DSW.get({start:83,end:93})
      }).then(t3 => {
        printer(t, {start:83,end:93}, t3, "EDGE CASE - Right Outside Trimmed ", 0);
        return DSW.get({start:68,end:78});
      }).then(t4 => {
        printer(t, {start:68,end:78}, t4, "Left Outside Trimmed", 1);
        return DSW.get({start:50,end:60});
      }).then(t5 => {
        printer(t, {start:50,end:60}, t5, "Left Outside Avail", 2);
        t.end();
        console.log("\n");
        console.log("Total Time: ",performance.now()-now1);
      })

    });

    test("###########          Series Tests - INIT START          ###########", t => {
      DSW.__availableData__=null;
      debug=[[null,null,null]];
      let now1=performance.now();
      Promise.resolve(DSW.get({start:0,end:10})).then(t1 => {
        printer(t, {start:0,end:10}, t1, "Init fetch", 2);
        return DSW.get({start:-1,end:9});
      }).then(t2 => {
        printer(t, {start:0,end:10}, t2, "EDGE CASE - Left Outside Avail ", 0);
        return DSW.get({start:3,end:13})
      }).then(t3 => {
        printer(t, {start:3,end:13}, t3, "EDGE CASE - Left Outside Trimmed", 0);
        return DSW.get({start:17,end:27});
      }).then(t4 => {
        printer(t, {start:17,end:27}, t4, "Right Outside Trimmed", 1);
        return DSW.get({start:32,end:42});
      }).then(t5 => {
        printer(t, {start:32,end:42}, t5, "Right Outside Avail", 2);
        t.end();
        console.log("\n");
        console.log("Total Time: ",performance.now()-now1);
      })

    });



    test("###########          Parallel Tests - INIT MID          ###########", t => {
      DSW.__availableData__=[];
      debug=[[null,null,null]];
      let now1=performance.now();

      DSW.get({start:45,end:55})
      .then(t1 => {
        printer(t, {start:45,end:55}, t1, "Init fetch", 2);        
      })

      DSW.get({start:50,end:60}).then(t1 => {
        printer(t, {start:50,end:60}, t1, "Right within Trimmed", 0);        
      })

      DSW.get({start:52,end:62}).then(t1 => {
        printer(t, {start:52,end:62}, t1, "Right outside Trimmed", 1);        
      })

      DSW.get({start:49,end:59}).then(t1 => {
        printer(t, {start:49,end:59}, t1, "Left within Trimmed", 0);        
      })

      DSW.get({start:48,end:58}).then(t1 => {
        printer(t, {start:48,end:58}, t1, "Left Outside Trimmed", 1);        
      })

      DSW.get({start:31,end:41}).then(t1 => {
        printer(t, {start:31,end:41}, t1, "Left Outside Avail", 2);        
      })

      DSW.get({start:55,end:65}).then(t1 => {
        printer(t, {start:55,end:65}, t1, "Right Outside Avail", 2);        
      })

      DSW.get({start:44,end:80}).then(t1 => {
        printer(t, {start:44,end:80}, t1, "Resize case", 2);        
      })

      //next/previous
      DSW.next().then(t1 => {
        printer(t, {start:45,end:81}, t1, "next", 0);        
      })
      DSW.next().then(t1 => {
        printer(t, {start:46,end:82}, t1, "next", 0);        
      })
      DSW.next().then(t1 => {
        printer(t, {start:47,end:83}, t1, "next", 0);        
      })
      DSW.next().then(t1 => {
        printer(t, {start:48,end:84}, t1, "next", 0);        
      })
      DSW.next().then(t1 => {
        printer(t, {start:49,end:85}, t1, "next", 0);        
      })
      DSW.next().then(t1 => {
        printer(t, {start:50,end:86}, t1, "next", 0);        
      })
      DSW.next().then(t1 => {
        printer(t, {start:51,end:87}, t1, "next", 1);        
      })
      DSW.previous().then(t1 => {
        printer(t, {start:50,end:86}, t1, "previous", 0);        
      })
      DSW.previous().then(t1 => {
        printer(t, {start:49,end:85}, t1, "previous", 0);        
      })
      DSW.previous().then(t1 => {
        printer(t, {start:48,end:84}, t1, "previous", 0);        
      })
      DSW.previous().then(t1 => {
        printer(t, {start:47,end:83}, t1, "previous", 0);        
      })
      DSW.previous().then(t1 => {
        printer(t, {start:46,end:82}, t1, "previous", 0);        
      })
      DSW.previous().then(t1 => {
        printer(t, {start:45,end:81}, t1, "previous", 0);        
      })
      DSW.previous().then(t1 => {
        printer(t, {start:44,end:80}, t1, "previous", 0);        
      })
      DSW.previous().then(t1 => {
        printer(t, {start:43,end:79}, t1, "previous", 1);        
      })



      DSW.get({start:-5,end:100}).then(t1 => {
        printer(t, {start:0,end:96}, t1, "OUT OF RANGE CASE", 2);
        t.end();
        console.log("\n");
        console.log("Total Time: ",performance.now()-now1);
      })

    });

    test("###########          Parallel Tests - INIT END          ###########", t => {
      DSW.__availableData__=null;
      debug=[[null,null,null]];
      let now1=performance.now();

      DSW.get({start:86,end:96}).then(t1 => {
        printer(t, {start:86,end:96}, t1, "Init fetch", 2);        
      })

      DSW.get({start:87,end:97}).then(t2 => {
        printer(t, {start:86,end:96}, t2, "EDGE CASE - Right Outside Avail ", 0);        
      });

      DSW.get({start:83,end:93}).then(t3 => {
        printer(t, {start:83,end:93}, t3, "EDGE CASE - Right Outside Trimmed ", 0);        
      })

      DSW.get({start:68,end:78}).then(t4 => {
        printer(t, {start:68,end:78}, t4, "Left Outside Trimmed", 1);        
      })

      DSW.get({start:50,end:60}).then(t5 => {
        printer(t, {start:50,end:60}, t5, "Left Outside Avail", 2);
        t.end();
        console.log("\n");
        console.log("Total Time: ",performance.now()-now1);
      })

    });

    test("###########          Parallel Tests - START          ###########",t=>{
      DSW.__availableData__=null;
      debug=[[null,null,null]];
      let now1=performance.now();

      DSW.get({start:0,end:10}).then(t1 => {
        printer(t, {start:0,end:10}, t1, "Init fetch", 2);})
      
      DSW.get({start:-1,end:9})
      .then(t2 => {
        printer(t, {start:0,end:10}, t2, "EDGE CASE - Left Outside Avail ", 0);
        
      })

      DSW.get({start:3,end:13}).then(t3 => {
        printer(t, {start:3,end:13}, t3, "EDGE CASE - Left Outside Trimmed", 0);
      })

       DSW.get({start:17,end:27}).then(t4 => {
        printer(t, {start:17,end:27}, t4, "Right Outside Trimmed", 1);        
      })

       DSW.get({start:32,end:42}).then(t5 => {
        printer(t, {start:32,end:42}, t5, "Right Outside Avail", 2);
        t.end();
        console.log("\n");
        console.log("Total Time: ",performance.now()-now1);
      })
    });

