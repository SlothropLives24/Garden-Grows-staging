
(function(){
  // O449 M3b (D-460; charter docs/DECISION-year-ring.md sections 8 and 15): A PLANT, TEAM OR GUIDE PAGE'S YEAR. Such a
  // page is built once for everyone and knows no place, so it is written with no ring: a slot (`data-yr`, written by
  // engine/pages/yearmine.py) that holds one line offering the year where the reader lives. A reader who has looked a
  // place up on this device (the frost lookup or "Can I still sow this?" keep it: the feed's yrRemember) gets that
  // place's ring here, drawn by the year ring's own module, under "Dates for ..." with a Change link. No date on the
  // page is ever someone else's. The crop's days are the feed's (yrPlant, yrTeam: the twins of the engine's own).
  var MON=["January","February","March","April","May","June","July","August","September","October","November","December"];
  var CUM=[0,31,59,90,120,151,181,212,243,273,304,334];
  function md(doy){if(doy>365)doy-=365;var m=11;while(m>0&&CUM[m]>=doy)m--;return MON[m]+" "+(doy-CUM[m]);}
  function esc(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  var L=0,GW={"A":"<span class=\"conf gA\">Well established</span>","B":"<span class=\"conf gB\">Promising</span>","C":"<span class=\"conf gC\">A good hunch</span>"},GP={"A":"Well established","B":"Promising","C":"A good hunch"};
  function cname(w){return w[L]||w[0];}
  function ctry(w){return w[2+L]||w[2];}
  function dist(k){return k<2?"less than 2 km (about a mile)":Math.round(k/1.609344)<2?""+Math.round(k)+" km (about a mile)":""+Math.round(k)+" km ("+Math.round(k/1.609344)+" miles)";}
  // where the module sits: beside the figure's sheet, which a page with a slot links (yearfig.yr_head_for). Never
  // the script's own element: this file is asked for with import() (yearmine.yr_mine_script), which has none.
  var YRL=document.querySelector?document.querySelector('link[href*="frost/yearring.css"]'):null,YRHERE=YRL?YRL.getAttribute("href").replace(/yearring\.css.*$/,""):"";
  // O449 (D-454; charter docs/DECISION-year-ring.md sections 3, 4 and 7): THE YEAR RING'S FEED IN THE BROWSER, one copy
  // for every script that draws a ring (engine/pages/tools.py _tool_script writes it in at the scripts' own mark): the
  // frost lookup (frost-tool.js), "Can I still sow this?" (still-time.js) and the plant, team and guide pages
  // (yearmine.js, O449 M3b). The drawing is THE SAME module the frost pages are built with - web/src/engine/yearring.ts
  // as the compiler emits it, published as frost/yearring.js (scripts/gen_yearring_site.py), which the conformance
  // golden holds to engine/yearring.py. This only FEEDS it, as engine/yearfeed.py and engine/pages/yearfig.py feed the
  // page's: a row's own odds, none filled in, and a crop's days as dispatch.plant_day and yearfeed.team_crops give them
  // (yrPlant, yrTeam: their twins, held to them over every place by engine/tests/test_pages_yearmine.py).
  // The module is an ES module and these scripts are not, so it arrives through a module script that hands it over
  // (window.ggYearRing); a browser that runs no modules draws no figure and keeps every word.
  // The host script sets YRHERE (where frost/yearring.js and frost/yearring.css are, "" to draw nothing: the engine's
  // tests run these scripts with no window) and has MON, CUM, esc, L, GP, dist, cname and ctry.
  var WIN=typeof window!=="undefined"?window:{},YR=WIN.ggYearRing||null,yrAsked=false,yrCss=false,yrDraw=null;
  function yrLoad(){
    if(yrAsked||!YRHERE)return;yrAsked=true;
    // the figure's own sheet (content/static/yearring.css): a page that links it has it already; one that does not
    // has it fetched with the module, once
    if(document.querySelector&&document.querySelector('link[href*="yearring.css"]'))yrCss=true;
    else{var c=document.createElement("link");c.rel="stylesheet";c.href=YRHERE+"yearring.css";
      c.onload=function(){yrCss=true;if(yrDraw)yrDraw();};document.head.appendChild(c);}
    document.addEventListener("gg-yearring",function(){YR=WIN.ggYearRing||null;if(yrDraw)yrDraw();});
    if(!YR){var m=document.createElement("script");m.type="module";m.src=YRHERE+"yearring.js";document.head.appendChild(m);}
  }
  // a day of the year as a ring day: counted from January 1 north of the equator, from July 1 south of it, so
  // midsummer is at the top of the ring everywhere (hemisphere.season_doy, yearfeed.ring_day)
  function rd(doy,south){return south?((doy-182)%365+365)%365+1:doy;}
  // a day of the year moved by days in a common year: 0 where it leaves the calendar, unless it may go around
  // (dispatch._mmdd_move)
  function ymv(d,n,around){var x=d+n;if(x<1||x>365){if(!around)return 0;x=((x-1)%365+365)%365+1;}return x;}
  // a row's odds, each side from its median to its 1 in 10, only the ones the record holds (yearfeed.frost_sides)
  // (a record that dates a MEDIAN beside a season of the whole year gives none: those dates stand for no frost,
  // yearfeed.dated_but_not_drawn)
  function yrSides(s){
    if((s[16]===1||s[11]>=365)&&(s[9]>0||s[10]>0))return [[],[]];
    function has(a){return a.filter(function(x){return x[0]>0;});}
    return [has([[s[9],.5],[s[8],.4],[s[7],.3],[s[6],.2],[s[5],.1]]),has([[s[10],.5],[s[15],.4],[s[14],.3],[s[13],.2],[s[12],.1]])];
  }
  var YW={"0.5":"half of years","0.4":"2 years in 5","0.3":"3 years in 10","0.2":"1 year in 5","0.1":"1 year in 10"};
  // the figure's own short date (yearfig.yr_short_date): "Apr 23", "23 abr"
  function ymd(doy){var m=11;while(m>0&&CUM[m]>=doy)m--;var ymon=MON[m].slice(0,3),yday=doy-CUM[m];return ""+ymon+" "+yday+"";}
  var YG=["Well established","Well established"];function yrSrc(k,st,di,wi,gr){return k===0?'From NOAA’s own record at <span class="stn" lang="en">'+st+'</span>, 1991–2020 · '+gr:k===1?'From the <span class="stn" lang="en">'+st+'</span> weather station, '+di+' away, '+wi+' winters · '+gr:k===2?'From a weather model, not a station, checked against <span class="stn" lang="en">'+st+'</span>’s record · '+gr:k===3?'From a weather model, not a station; no long record nearby to check it against · '+gr:'From the <span class="stn" lang="en">'+st+'</span> weather station, '+di+' away, 30 winters · '+gr;}
  // A place's source sentence, the how-sure line's own (yrSrc): the row `s`, its city `w` where it was looked up by
  // name, and `rz`, a ZIP's own distance and grade (the frost lookup's reach). A ZIP's says the planner's grade at the
  // ZIP, as the lookup's answer does; a place with no grade of its own, the registry's for its kind of record.
  function yrPlaceSrc(s,w,rz){
    var model=s[17]===2,sd=model&&s.length>24,stw=model&&s[19]?s[19]:0,adj=s[17]===1;
    return model?yrSrc(sd?1:stw?2:3,esc(sd?s[24]:s[20]),sd?dist(s[26]):"",sd?s[27]:"",w?GP[w[9]]:"")
      :yrSrc(adj?4:0,esc(s[0]),adj?dist(s[18]):"","",rz?GP[rz[1]]:YG[adj?1:0]);
  }
  // The figure and what stands under it, as yearfig.yr_figure_html writes them on a page: the ring, its key, the one
  // sentence, the source sentence and the fold. "" where the module is not here, or refuses the record (its odds out
  // of the order of their days): the page's words stand without a figure. `o` (all optional): crops, the lines inside
  // the ring ([{name,sow,end,filled,indoor}] in ring days); notes, dated labels of the page's own ([[ring day, date,
  // word]]); today, today's day of the year (a tool that reads the clock draws its dot); season, the two medians named
  // "last frost" and "first frost" in place of each side's odds (a garden's figure, yearfig.yr_season_labels); says,
  // the one sentence where it is not the days'; words, a fold line of the page's own in place of the catalog's (by its
  // key: how_crop); keyhead, a few words before the key's names; band, on a band; small, the mark alone, with none of its words.
  function yrFigure(s,place,src,twin,o){
    o=o||{};
    if(!YR||!yrCss||(!src&&!o.small))return "";
    var south=s[3]<0,sides=yrSides(s),labs=[],names=[],mids=[],cum=0,DM=[31,28,31,30,31,30,31,31,30,31,30,31],fig;
    if(o.season){if(s[9]>0)labs.push([rd(s[9],south),[ymd(s[9]),"last frost"]]);if(s[10]>0)labs.push([rd(s[10],south),[ymd(s[10]),"first frost"]]);}
    else sides.forEach(function(side){(side.length>1?[side[0],side[side.length-1]]:side).forEach(function(d){labs.push([rd(d[0],south),[ymd(d[0]),YW[String(d[1])]]]);});});
    for(var i=0;i<12;i++){var mo=south?(i+6)%12:i;names.push(MON[mo].slice(0,3));mids.push(cum+15);cum+=DM[mo];}
    function ring(side){return side.map(function(d){return [rd(d[0],south),d[1]];});}
    var opts={frost_labels:labs,month_names:names,mids:mids};
    if(o.crops&&o.crops.length)opts.crops=o.crops.map(function(c){return {name:c.name,sow:c.sow,end:c.end,filled:!!c.filled,indoor:c.indoor==null?null:c.indoor,tint:null};});
    if(o.notes)opts.notes=o.notes;
    if(o.today>0){opts.today=rd(o.today,south);opts.today_label=["today",ymd(o.today)];}
    if(o.small){opts.labels=false;opts.months=false;opts.names=false;}
    try{fig=YR.year(new YR.Place(YR.seedOf(String(s[2])),ring(sides[0]),ring(sides[1])),opts);}catch(e){return "";}
    var aria=(opts.crops?"The year at "+place+", drawn as a ring: fine marks where frost is likely, one green stroke for the season with no frost, and a line inside the ring for each crop, from its sowing to its first picking.":"The year at "+place+", drawn as a ring: fine marks where frost is likely and one green stroke for the season with no frost.").replace(/"/g,"&quot;"),
        svg='<svg class="yr-fig" viewBox="'+fig.viewBox+'" role="img" aria-label="'+aria+'"'+(twin?' aria-describedby="'+twin+'"':'')+'>'+fig.svg+'</svg>';
    if(o.small)return '<figure class="yr yr-small">'+svg+'</figure>';
    var n=s[11],yfoot=MON[south?6:0],words={how_season:"The green stroke is the season with no frost.",how_frost:"The marked line is when frost is likely: more marks, more likely.",how_crop:"A line inside is a crop: it starts the day it is sown and its dot is the first picking.",how_many:"A crop sown more than once is one line, thicker where more of it is in the ground.",
        how_planned:"A dashed line is a sowing that is planned.",how_indoor:"A dotted lead-in is the time it spends indoors first.",how_last:"The fainter ring inside is last year.",how_today:"The dot on the ring is today.",how_turn:"It reads clockwise from "+yfoot+" at the foot, with midsummer at the top."};
    if(o.words)for(var wk in o.words)words[wk]=o.words[wk];
    var rows=YR.foldRows(fig.marks,words).map(function(r){return '<li'+(r[0]==="turn"?' class="yr-turn"':'')+'>'+YR.swatch(r[0])+'<span>'+esc(r[1])+'</span></li>';}).join("");
    // the names under the figure, in sowing order: a letter and its line's own mark (yearfig.yr_key_html)
    var key=fig.key.filter(function(k){return k[0];}).map(function(k){return '<span>'+YR.keySwatch(k[3])+'<i>'+k[0]+'</i> '+esc(k[1])+'</span>';}).join("");
    return '<figure class="yr'+(o.band?' yr-band':'')+'">'+svg+(key?'<p class="yr-key">'+(o.keyhead?'<span class="yr-keyh">'+esc(o.keyhead)+'</span>':'')+key+'</p>':'')
      +'<p class="yr-says">'+esc(o.says||"The green stroke is about "+n+" days with no frost, in half of years.")+'</p><p class="yr-src">'+src+'</p>'
      +'<details class="seed yr-how"><summary>How to read this</summary><div class="seed-leaf"><ul class="yr-rows">'+rows+'</ul></div></details></figure>';
  }
  // --- the place a reader last looked up, kept on this device (O449 M3b, D-460: a plant, team or guide page draws a
  // year only for the reader's own place). The two lookups write it (yrRemember) with what they answered from: the
  // row, the city where it was looked up by name, the ZIP typed and its own distance and grade, the row's warm days
  // (the frost data's YD) and the data's version. Nothing is sent anywhere. A page reads it (yrPlace) and draws; a
  // place kept from other data than this build's is not read (its dates may have changed): the reader is offered the
  // lookup again. A browser with no storage keeps nothing and every page keeps its words.
  var YRKEY="gg-place",YRV="1a83baf4";
  function yrRemember(D,s,w,zs,rz){
    try{var i=D.S.indexOf(s);if(i<0)return;
      localStorage.setItem(YRKEY,JSON.stringify({v:YRV,s:s,w:w||0,z:zs||"",r:rz||0,y:(D.YD||{})[i]||0}));}catch(e){}
  }
  function yrPlace(){
    try{var p=JSON.parse(localStorage.getItem(YRKEY)||"null");
      return p&&p.v===YRV&&p.s&&p.s.length>16&&(p.w||p.z)?p:null;}catch(e){return null;}
  }
  // A reader sent to a lookup from a page that draws a year (yearmine.js keeps where they came from, for this tab
  // alone) is offered the way back, above the answer.
  function yrBack(out){
    try{var b=JSON.parse(sessionStorage.getItem("gg-yr-back")||"null");
      if(!b||typeof b.u!=="string"||b.u.charAt(0)!=="/"||b.u.charAt(1)==="/"||!b.t)return;
      // its address is set on the element, never written into markup: the site's link check and the Spanish page's
      // move both read every href a script's text holds
      var ytitle=esc(b.t),p=document.createElement("p"),a=document.createElement("a");p.className="yr-back";
      a.className="btn btn-secondary";a.setAttribute("href",b.u);a.innerHTML="Back to "+ytitle+"";p.appendChild(a);
      out.insertBefore(p,out.firstChild);}catch(e){}
  }
  // A ZIP's own distance from its site and the planner's grade there (the frost data's Z, K and G: the frost
  // lookup's reach), for a script that has not unpacked them: [km, grade letter], or null for a ZIP not on the list.
  function yrReach(D,zi){
    if(!D.Zs){var Z=(D.Z||[]).slice();for(var j=1;j<Z.length;j++)Z[j]=Z[j]+Z[j-1];D.Zs=Z;}
    var lo=0,hi=D.Zs.length-1;
    while(lo<=hi){var mid=(lo+hi)>>1;if(D.Zs[mid]===zi)return [D.K[mid],D.G.charAt(mid)];if(D.Zs[mid]<zi)lo=mid+1;else hi=mid-1;}
    return null;
  }
  // a kept place as a reader names it: the ZIP typed, or the city and its country
  function yrPlaceName(p){var zs=p.z;return p.w?esc(cname(p.w))+", "+esc(ctry(p.w)):"ZIP "+esc(zs)+"";}

  // One crop's days at a place, as dispatch.plant_day and yearfeed.plant_crop give them (the twin of the app's "When
  // do I plant this?"; engine/tests/test_pages_yearmine.py holds this to them over every row of the frost data).
  // c: [path, wait, off, weeks, days, warm] - path 0 a frost-tender crop (R-031, R-171, R-190), 1 a hardy or
  // half-hardy crop dated by days (R-096); wait R-171's days past the median last frost; off R-096's days before it;
  // weeks R-097's indoor start; days the fewest days to maturity; warm the crop's place in the frost data's YC (-1 for
  // none). y is the place's warm days. null where Answers dates no spring planting here (no median last frost, or
  // frost rare: those places are dated by months). Days are days of the year; sow, end and indoor are ring days.
  function yrPlant(s,c,y){
    var p50=s[9],p10=s[5],south=s[3]<0;
    if(!(p50>0)||s[11]>=365)return null;
    function sd(d){return rd(d,south);}
    function later(fr,wd){return wd>0&&sd(wd)>sd(fr)?wd:fr;}          // dispatch.warm_plant_mmdd
    var wd=c[5]>=0?(typeof y==="number"?y:(y||[])[c[5]]||0):0,day,kind,shift=0;
    if(c[0]===0){
      var late0=c[1]>0?ymv(p50,c[1],false):0;
      if(late0){day=later(late0,wd);kind=day!==late0?"warm_ground":"warm";shift=sd(day)-sd(late0);}
      else{var d=later(p50,wd);
        if(d!==p50&&(!(p10>0)||sd(d)-sd(p10)>=0)){day=d;kind="warm_ground";shift=sd(d)-sd(p50);}
        else if(p10>0){day=p10;kind="safe";}
        else{day=p50;kind="median";}}
    }else if(c[2]>0){day=ymv(p50,-c[2],false)||ymv(p50,-c[2],true);kind="cool";}
    else{day=p50;kind="median";}
    var ind=c[3]>0?ymv(p50,-c[3]*7+shift,true):0,d0=sd(day),din=ind?sd(ind):null;
    if(din!=null&&din>=d0){din=null;ind=0;}
    return {sow:d0,end:d0+c[4],indoor:din,day:day,ind:ind,pick:ymv(day,c[4],true),kind:kind};
  }
  // A team's crops at a place, as yearfeed.team_sowings and team_crops give them - the twin of the app's own reading
  // (exampleplace.ts sowings, "as the Calendar dates them"): the team's planting day (the median last frost, or R-096's
  // lead before it for a cold-hardy team); each frost-tender planting on the later of its frost day and R-190's warm
  // day, the whole team's day moving with them where every one waits (D-420); a very tender crop R-171's wait after the
  // team's day; the climber its lead after its support (R-033), never before its own warm day. Each is first picked
  // its fewest days to maturity later. t: [lead, wait, after, [[name, days, warm, tender, held, very, role], ...]] as
  // pages/yearmine.py yr_team_spec writes it; y the place's warm days. null where the place dates no planting
  // (yrPlant's rule). A planting with no days is not drawn. Days are counted in the season (rd), so they run on past
  // its end without wrapping until the ring day is taken.
  function yrTeam(s,t,y){
    var p50=s[9],south=s[3]<0;
    if(!(p50>0)||s[11]>=365)return null;
    function X(d){return rd(d,south);}
    function wrap(x){return ((x-1)%365+365)%365+1;}
    function cal(x){var r=wrap(x);return south?(r+180)%365+1:r;}
    var cs=t[3],plant=X(p50)-(t[0]>0?t[0]:0),own=[],first=0,any=false,all=true,i;
    if(!(t[0]>0))for(i=0;i<cs.length;i++){
      if(!cs[i][3])continue;
      any=true;
      var wd=cs[i][2]>=0?(typeof y==="number"?y:(y||[])[cs[i][2]]||0):0,base=cs[i][4]&&t[1]>0?(p50-1+t[1])%365+1:p50,
          day=wd>0&&X(wd)>X(base)?wd:base;
      if(wd>0&&day!==base){own[i]=X(day);if(!first||first>X(day))first=X(day);}else all=false;
    }
    var move=any&&all&&first&&first>X(p50)?first-X(p50):0,climb=t[2]>0&&p50+t[2]<=365?X(p50+t[2]):0,sup=0;
    if(climb)for(i=0;i<cs.length;i++)if(cs[i][6]===2&&own[i]){sup=own[i];break;}
    var out=[];
    for(i=0;i<cs.length;i++){
      var x;
      if(climb&&cs[i][6]===1){x=climb+move;if(sup&&sup+t[2]>x)x=sup+t[2];if(own[i]&&own[i]>x)x=own[i];}
      else x=own[i]?own[i]:plant+(cs[i][5]?t[1]:0);
      if(cs[i][1]>0){var d0=wrap(x),c=cal(x);out.push({name:cs[i][0],sow:d0,end:d0+cs[i][1],indoor:null,filled:false,day:c,pick:ymv(c,cs[i][1],true)});}
    }
    return out;
  }

  var slots=document.querySelectorAll?document.querySelectorAll("[data-yr]"):[];
  if(!slots.length)return;
  var waited=false;
  function today(){var n=new Date();return Math.min(365,CUM[n.getMonth()]+n.getDate());}
  // "Corn and Summer squash", "Corn, Common bean and Summer squash"
  function list(a){if(a.length<2)return a.join("");var ya=a.slice(0,-1).join(", "),yb=a[a.length-1];return ""+ya+" and "+yb+"";}
  // What a slot holds for a kept place: "" while the module is on its way (the slot keeps what it shows), else the
  // figure with its words, or the one line that says why this place draws none.
  function build(spec,p,change,id){
    var s=p.s,src=yrPlaceSrc(s,p.w||null,p.r||null),place=p.w?esc(cname(p.w))+", "+esc(ctry(p.w)):esc(s[0])+", "+esc(s[1]),
        where=yrPlaceName(p),twin=id+"-dates",
        head='<p class="yr-for"><span>'+"Dates for "+where+""+'</span> '+change+'</p>',
        none='<p class="yr-none">'+"No ring is drawn for "+where+": frost is rare there, or its record dates no last frost in a usual year, so planting there goes by each month’s warmth."+' '+change+'</p>';
    if(!YR||!yrCss)return "";
    if(spec.k==="place"){
      // the place's own year, as the frost lookup draws it: where its frost sets a season
      if(!(s[9]>0&&s[11]>0&&s[11]<365)||s[16]===1)return none;
      return (yrFigure(s,place,src,"")||none)+head;
    }
    if(spec.k==="team"){
      var cs=yrTeam(s,spec.t,p.y);
      if(!cs||!cs.length)return none;
      var fig=yrFigure(s,place,src,twin,{crops:cs,small:true}),days=[],by={};
      if(!fig)return none;
      cs.forEach(function(c){if(!by[c.day]){by[c.day]=[];days.push(c.day);}by[c.day].push(esc(c.name));});
      var parts=days.map(function(d){var ycrops=list(by[d]),ydate=esc(md(d));return ""+ycrops+" from about "+ydate+"";}).join("; ");
      return fig+'<p class="yr-when" id="'+twin+'"><b>When.</b> '+parts+'.</p><p class="yr-src">'+src+'</p>'+head;
    }
    var c=spec.c,d=yrPlant(s,c.slice(1),p.y),ycrop=esc(c[0]);
    if(!d)return none;
    var notes=[],rows=[];
    if(d.indoor!=null){notes.push([d.indoor,ymd(d.ind),"indoors"]);rows.push(["Start indoors",md(d.ind)]);}
    notes.push([d.sow,ymd(d.day),c[4]>0?"set out":"sow"]);
    rows.push([c[4]>0?"Set out":"Sow outdoors",md(d.day)]);
    notes.push([d.end,ymd(d.pick),"first picking"]);rows.push(["First picking, from about",md(d.pick)]);
    var one=yrFigure(s,place,src,twin,{crops:[{name:c[0],sow:d.sow,end:d.end,indoor:d.indoor,filled:true}],notes:notes,today:today(),season:true});
    if(!one)return none;
    return one+head+'<dl class="facts yr-dates" id="'+twin+'">'+rows.map(function(r){return '<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>';}).join("")+'</dl>';
  }
  function draw(){
    var p=yrPlace();
    for(var i=0;i<slots.length;i++){
      var el=slots[i],here=el.querySelector(".yr-here"),offer=el.querySelector(".yr-offer"),link=offer&&offer.querySelector("a"),spec=null;
      try{spec=JSON.parse(el.getAttribute("data-yr"));}catch(e){}
      if(!here||!link||!spec)continue;
      if(!p){here.innerHTML="";here.hidden=true;offer.hidden=false;continue;}
      var html=build(spec,p,'<a class="yr-change">Change</a>',el.id||"yrm"+i);
      // "Change" is the offer's own link, its address set on the element (never composed into markup)
      if(html){here.innerHTML=html;here.hidden=false;var ch=here.querySelector(".yr-change");if(ch)ch.setAttribute("href",link.getAttribute("href"));}
      offer.hidden=true;
    }
    // the module is asked for once; a browser it never reaches (no modules) gets the offer back, and keeps every word
    if(p&&(!YR||!yrCss)){yrDraw=draw;yrLoad();
      if(!waited){waited=true;setTimeout(function(){if(!YR||!yrCss)for(var j=0;j<slots.length;j++){var o=slots[j].querySelector(".yr-offer");if(o)o.hidden=false;}},6000);}}
  }
  // the way to the lookup keeps where the reader came from, for this tab alone, so the lookup can offer the way back
  document.addEventListener("click",function(e){
    var a=e.target&&e.target.closest?e.target.closest(".yr-offer a,.yr-change"):null;if(!a)return;
    try{var h=document.querySelector("h1");sessionStorage.setItem("gg-yr-back",JSON.stringify({u:location.pathname,t:h?h.textContent.replace(/\s+/g," ").trim():document.title}));}catch(x){}
  });
  // drawn when the page loads, and again when the reader comes back to it from the lookup
  draw();
  WIN.addEventListener&&WIN.addEventListener("pageshow",function(e){if(e.persisted)draw();});
})();
