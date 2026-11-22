
(function(){
  var MON=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  var CUM=[0,31,59,90,120,151,181,212,243,273,304,334];
  function md(doy){if(doy>365)doy-=365;var m=11;while(m>0&&CUM[m]>=doy)m--;return (doy-CUM[m])+" de "+MON[m];}
  // O238: a fall freeze dated before the spring's median last frost belongs to the next year. Arcadia's first freeze
  // straddles the New Year (1 year in 10 by December 8, half of years by January 4), so those dates count on past 365
  // and keep their order; md() reads them back as calendar dates.
  function fw(d,s){return d&&s[9]&&d<s[9]?d+365:d;}
  function esc(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  // D-349 point 2: with no garden placed, the place looked up sets the season's colours - the same two keys the app's
  // units.ts rememberLookupHemisphere writes, and the page shell's pre-paint season arithmetic, restamped at once
  function lookupHemi(lat){try{var H="gg-hemi",M="gg-hemi-src";if(!isFinite(lat)||(localStorage.getItem(H)!==null&&localStorage.getItem(M)!=="lookup"))return;var h=lat<0?"s":"n";localStorage.setItem(H,h);localStorage.setItem(M,"lookup");var S=["spring","summer","autumn","winter"];if(S.indexOf(localStorage.getItem("gg-season"))>=0)return;var n=S[Math.floor(((new Date().getMonth()+10)%12)/3)];document.documentElement.setAttribute("data-season",h==="s"?S[(S.indexOf(n)+2)%4]:n);}catch(e){}}
  // O175 M4: a city abroad, by name (the page's language L, 0 English or 1 Spanish, and its grade words GW
  // are set by the page builder). Matched without accents or case, in either language: Munich, Múnich.
  var L=1,GW={"A":"<span class=\"conf gA\">Bien establecido</span>","B":"<span class=\"conf gB\">Prometedor</span>","C":"<span class=\"conf gC\">Una buena corazonada</span>"},GP={"A":"Bien establecido","B":"Prometedor","C":"Una buena corazonada"};
  function fold(t){return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  function cname(w){return w[L]||w[0];}
  function ctry(w){return w[2+L]||w[2];}
  function dist(k){return k<2?"menos de 2 km (más o menos una milla)":Math.round(k/1.609344)<2?""+Math.round(k)+" km (más o menos una milla)":""+Math.round(k)+" km ("+Math.round(k/1.609344)+" millas)";}
  var inp=document.getElementById("ft-zip"),out=document.getElementById("ft-out");
  if(!inp||!out)return;
  var DATA=null,loading=false,pending=null;
  function load(){
    if(DATA||loading)return;loading=true;yrLoad();
    fetch("../../frost/data.json").then(function(r){return r.json();}).then(function(d){
      var F=d.Fd.slice();for(var i=1;i<F.length;i++)F[i]=F[i]+F[i-1];d.F=F;
      var Z=(d.Z||[]).slice();for(var j=1;j<Z.length;j++)Z[j]=Z[j]+Z[j-1];d.Zs=Z;DATA=d;loading=false;
      if(pending!=null){pending=null;go();}
    }).catch(function(){loading=false;out.innerHTML='<p class="ft-empty">No se pudieron cargar los datos de heladas. Mejor consulta las <a href="#us-list">fechas de helada por lugar</a>.</p>';});
  }
  function lookup(zi){
    var F=DATA.F,lo=0,hi=F.length-1,k=-1;
    while(lo<=hi){var mid=(lo+hi)>>1;if(F[mid]<=zi){k=mid;lo=mid+1;}else{hi=mid-1;}}
    if(k<0||zi>F[k]+DATA.D[k])return null;
    return DATA.S[DATA.I[k]];
  }
  // O173 place 8: how far a ZIP's centroid is from the site its dates come from, and the planner's grade there
  function reach(zi){
    var Z=DATA.Zs,lo=0,hi=Z.length-1;
    while(lo<=hi){var mid=(lo+hi)>>1;if(Z[mid]===zi)return [DATA.K[mid],DATA.G.charAt(mid)];if(Z[mid]<zi)lo=mid+1;else hi=mid-1;}
    return null;
  }
  // O449 M2: the looked-up place's year, drawn as the ring its own frost page draws, by the same module. The feed is
  // one copy for every script that draws a ring (content/static/yearring-feed.js, written in here by the page build);
  // the module and the figure's sheet sit beside this script. (the engine's tests run this script with no window and
  // no script element: then no figure is asked for)
  var YRHERE=(document.currentScript&&document.currentScript.src||"").replace(/[^\/]*$/,"");
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
  var YW={"0.5":"la mitad","0.4":"2 de cada 5","0.3":"3 de cada 10","0.2":"1 de cada 5","0.1":"1 de cada 10"};
  // the figure's own short date (yearfig.yr_short_date): "Apr 23", "23 abr"
  function ymd(doy){var m=11;while(m>0&&CUM[m]>=doy)m--;var ymon=MON[m].slice(0,3),yday=doy-CUM[m];return ""+yday+" "+ymon+"";}
  var YG=["Bien establecido","Bien establecido"];function yrSrc(k,st,di,wi,gr){return k===0?'Del registro propio de la NOAA en <span class="stn" lang="en">'+st+'</span>, 1991–2020 · '+gr:k===1?'De la estación meteorológica de <span class="stn" lang="en">'+st+'</span>, a '+di+', '+wi+' inviernos · '+gr:k===2?'De un modelo del tiempo, no de una estación, cotejado con el registro de <span class="stn" lang="en">'+st+'</span> · '+gr:k===3?'De un modelo del tiempo, no de una estación; sin un registro largo cerca con que cotejarlo · '+gr:'De la estación meteorológica de <span class="stn" lang="en">'+st+'</span>, a '+di+', 30 inviernos · '+gr;}
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
    if(o.season){if(s[9]>0)labs.push([rd(s[9],south),[ymd(s[9]),"última helada"]]);if(s[10]>0)labs.push([rd(s[10],south),[ymd(s[10]),"primera helada"]]);}
    else sides.forEach(function(side){(side.length>1?[side[0],side[side.length-1]]:side).forEach(function(d){labs.push([rd(d[0],south),[ymd(d[0]),YW[String(d[1])]]]);});});
    for(var i=0;i<12;i++){var mo=south?(i+6)%12:i;names.push(MON[mo].slice(0,3));mids.push(cum+15);cum+=DM[mo];}
    function ring(side){return side.map(function(d){return [rd(d[0],south),d[1]];});}
    var opts={frost_labels:labs,month_names:names,mids:mids};
    if(o.crops&&o.crops.length)opts.crops=o.crops.map(function(c){return {name:c.name,sow:c.sow,end:c.end,filled:!!c.filled,indoor:c.indoor==null?null:c.indoor,tint:null};});
    if(o.notes)opts.notes=o.notes;
    if(o.today>0){opts.today=rd(o.today,south);opts.today_label=["hoy",ymd(o.today)];}
    if(o.small){opts.labels=false;opts.months=false;opts.names=false;}
    try{fig=YR.year(new YR.Place(YR.seedOf(String(s[2])),ring(sides[0]),ring(sides[1])),opts);}catch(e){return "";}
    // on a band the stroke is pale, on the paper the season's green (D-474 point 10): the words name it as drawn
    var aria=(o.band?(opts.crops?"El año en "+place+", dibujado como un anillo: marcas finas donde es probable que hiele, un trazo claro para la temporada sin heladas y, dentro del anillo, una línea por cada cultivo, desde su siembra hasta su primera cosecha.":"El año en "+place+", dibujado como un anillo: marcas finas donde es probable que hiele y un trazo claro para la temporada sin heladas."):(opts.crops?"El año en "+place+", dibujado como un anillo: marcas finas donde es probable que hiele, un trazo verde para la temporada sin heladas y, dentro del anillo, una línea por cada cultivo, desde su siembra hasta su primera cosecha.":"El año en "+place+", dibujado como un anillo: marcas finas donde es probable que hiele y un trazo verde para la temporada sin heladas.")).replace(/"/g,"&quot;"),
        svg='<svg class="yr-fig" viewBox="'+fig.viewBox+'" role="img" aria-label="'+aria+'"'+(twin?' aria-describedby="'+twin+'"':'')+'>'+fig.svg+'</svg>';
    if(o.small)return '<figure class="yr yr-small">'+svg+'</figure>';
    var n=s[11],yfoot=MON[south?6:0],words={how_season:o.band?"El trazo claro es la temporada sin heladas.":"El trazo verde es la temporada sin heladas.",how_frost:"La línea con marcas es cuando es probable que hiele: más marcas, más probable.",how_crop:"Una línea por dentro es un cultivo: empieza el día en que se siembra y su punto es la primera cosecha.",how_many:"Un cultivo sembrado más de una vez es una sola línea, más gruesa donde hay más en la tierra.",
        how_planned:"Una línea discontinua es una siembra que está planificada.",how_indoor:"Un tramo punteado al principio es el tiempo que pasa primero bajo techo.",how_last:"El anillo más tenue de dentro es el año pasado.",how_today:"El punto sobre el anillo es hoy.",how_turn:"Se lee en el sentido de las agujas del reloj desde "+yfoot+", abajo, con el pleno verano arriba."};
    if(o.words)for(var wk in o.words)words[wk]=o.words[wk];
    var rows=YR.foldRows(fig.marks,words).map(function(r){return '<li'+(r[0]==="turn"?' class="yr-turn"':'')+'>'+YR.swatch(r[0])+'<span>'+esc(r[1])+'</span></li>';}).join("");
    // the names under the figure, in sowing order: a letter and its line's own mark (yearfig.yr_key_html)
    var key=fig.key.filter(function(k){return k[0];}).map(function(k){return '<span>'+YR.keySwatch(k[3])+'<i>'+k[0]+'</i> '+esc(k[1])+'</span>';}).join("");
    return '<figure class="yr'+(o.band?' yr-band':'')+'">'+svg+(key?'<p class="yr-key">'+(o.keyhead?'<span class="yr-keyh">'+esc(o.keyhead)+'</span>':'')+key+'</p>':'')
      +'<p class="yr-says">'+esc(o.says||(o.band?"El trazo claro son unos "+n+" días sin heladas, en la mitad de los años.":"El trazo verde son unos "+n+" días sin heladas, en la mitad de los años."))+'</p><p class="yr-src">'+src+'</p>'
      +'<details class="seed yr-how"><summary>Cómo leer esto</summary><div class="seed-leaf"><ul class="yr-rows">'+rows+'</ul></div></details></figure>';
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
      a.className="btn btn-secondary";a.setAttribute("href",b.u);a.innerHTML="Volver a "+ytitle+"";p.appendChild(a);
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
  function yrPlaceName(p){var zs=p.z;return p.w?esc(cname(p.w))+", "+esc(ctry(p.w)):"el código postal "+esc(zs)+"";}

  function render(zs){
    var s=lookup(parseInt(zs,10));
    // O194 (21): a listed ZIP far from every station is told so; any other miss is not a ZIP we know
    if(!s){out.innerHTML=(DATA.X||[]).indexOf(parseInt(zs,10))>=0?'<p class="ft-empty">No hay ninguna estación de NOAA cerca del código postal '+esc(zs)+'. Mejor consulta los <a href="#us-list">lugares más cercanos de la lista</a>.</p>':'<p class="ft-empty">No reconocemos el código postal '+esc(zs)+' de EE. UU. Revisa el número, o consulta los <a href="#us-list">lugares más cercanos de la lista</a>.</p>';return;}
    answer(s,null,zs);
  }
  // A city's answer is a ZIP's, said of the city: a modeled one ([17] = 2) names its model, its distance, its
  // grade and its credit, and one in reach of a US station names the station, as the city's own page does.
  function answer(s,w,zs){
    lookupHemi(s[3]/100);
    // D-363: a city whose frost dates are a dated GHCN-Daily station's own ([24]-[27], its page's) - the model's words
    // never speak for them (mw), and the source names the station; two, where the word's station is another (by id,
    // [31] against [25], O359 m15); near, where it is only nearer, not frostier ([22]/[23] against [32]/[33]), so the
    // answer says the dates' station has the longer record and no more (O359 m5)
    var model=s[17]===2,sd=model&&s.length>24,two=sd&&s[31]!==s[25],near=two&&!(s[22]*s[33]>s[32]*s[23]),mw=model&&!sd,adj=s[17]===1,city=w?esc(cname(w)):"",nm=model?city:esc(s[0]),
        place=w?city+", "+esc(ctry(w)):esc(s[0])+", "+esc(s[1]),lat=(s[3]/100).toFixed(2),lon=(s[4]/100).toFixed(2),h=[];
    // A handful of frost-free stations (year-round season) record last-frost odds that STRADDLE the
    // New Year: the late 1-in-10 tail lands in January while the median sits in late December, so on
    // the calendar the tail comes numerically BEFORE the median. These are said in their own words (the
    // year-round and most-of-the-year answers below), never as a plain spring.
    var p50=s[9],p10=s[5],wrap=(!p10||!p50||p10<p50);
    // O175 M3: a wrap with a SHORT season is the opposite case - frost most of the year, its late tail running past
    // the New Year (La Paz's model cell: median Dec 30, 1 in 10 Jan 13, a 27-day season). Said as that, never as
    // "frost is rare"; frostdata.frost_most_of_year asks the pages the same question (MOST_OF_YEAR_DAYS).
    var most=!!(p10&&p50&&p10<p50&&s[11]&&s[11]<180);
    // The two answers, each a block. They are built in a fixed order and then ORDERED by the
    // reader's own month, so whoever arrives in August meets the freeze question first and whoever
    // arrives in February meets the frost question first (O105a). The clock is used for THAT and
    // nothing else - no date here is computed from it, and both blocks are always present, so a
    // reader with no JS, or one who arrives at the boundary, loses only the running order.
    // O238 (17): frost is rare by the app's rule (frostdata.frost_rare): no freeze recorded ([16]), or a median
    // season of the whole year ([11]), whose median dates sit on the turn of the year and stand for no frost
    // D-323: a modeled city whose frosts come in a quarter or more of winters ([18], the day a frost-tender crop waits
    // for) is told "some winters", never "rare" (Melbourne: 15 of 29), as its page says (frostdata.frost_some_winters)
    var spring=[],autumn=[],free=s[16]===1||s[11]>=365,some=model&&s[18]?s[18]:0;
    // The station gate: a weather station's own count of frost winters ([19]: 1 rare, 2 some winters, 3 most winters)
    // sets a modeled city's frost word, and the answer names the station ([20]-[23]), as the city's page does
    var stw=model&&s[19]?s[19]:0;
    if(stw&&free){
      spring.push('<p class="answer">'+(stw===1?(s[22]?'En <strong>'+place+'</strong> las heladas son raras. La estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados, así que no hay fecha de última helada con la cual planificar y la temporada de cultivo dura todo el año.':'En <strong>'+place+'</strong> las heladas son raras. La estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', no registró ninguna helada en sus '+s[23]+' inviernos registrados, así que la temporada de cultivo dura todo el año.'):sd?(stw===2?(some?(two?(near?'En <strong>'+place+'</strong> hiela algunos inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados, así que un cultivo sensible a la helada espera hasta después del '+esc(md(s[18]))+', la fecha tardía de helada de la estación meteorológica de '+esc(s[24])+', a '+dist(s[26])+'. Esa estación tiene el registro más largo.':'En <strong>'+place+'</strong> hiela algunos inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados, así que un cultivo sensible a la helada espera hasta después del '+esc(md(s[18]))+', la fecha tardía de helada de la estación meteorológica de '+esc(s[24])+', a '+dist(s[26])+'. Esa estación tiene el registro más largo, así que la helada puede llegar más tarde.'):'En <strong>'+place+'</strong> hiela algunos inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados, así que un cultivo sensible a la helada espera hasta después del '+esc(md(s[18]))+', la fecha tardía de helada de la propia estación.'):'En <strong>'+place+'</strong> hiela algunos inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados. Las fechas de helada de la estación meteorológica de '+esc(s[24])+' no dan allí una fecha tardía de helada que esperar, así que planta los cultivos sensibles a la helada después de tu propia última helada.'):(some?(two?(near?'En <strong>'+place+'</strong> hiela la mayoría de los inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados. Un cultivo sensible a la helada espera hasta después del '+esc(md(s[18]))+', la fecha tardía de helada de la estación meteorológica de '+esc(s[24])+', a '+dist(s[26])+'. Esa estación tiene el registro más largo.':'En <strong>'+place+'</strong> hiela la mayoría de los inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados. Un cultivo sensible a la helada espera hasta después del '+esc(md(s[18]))+', la fecha tardía de helada de la estación meteorológica de '+esc(s[24])+', a '+dist(s[26])+'. Esa estación tiene el registro más largo, así que la helada puede llegar más tarde.'):'En <strong>'+place+'</strong> hiela la mayoría de los inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados. Un cultivo sensible a la helada espera hasta después del '+esc(md(s[18]))+', la fecha tardía de helada de la propia estación, y la helada puede llegar más tarde.'):'En <strong>'+place+'</strong> hiela la mayoría de los inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados. Las fechas de helada de la estación meteorológica de '+esc(s[24])+' no dan allí una fecha tardía de helada que esperar, así que planta los cultivos sensibles a la helada después de tu propia última helada.')):stw===2?(some?'En <strong>'+place+'</strong> hiela algunos inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados, así que un cultivo sensible a la helada espera hasta después del '+esc(md(s[18]))+', la fecha tardía de helada del modelo meteorológico.':'En <strong>'+place+'</strong> hiela algunos inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados. El modelo meteorológico no tiene fecha de helada allí, así que planta los cultivos sensibles a la helada después de tu propia última helada.'):(some?'En <strong>'+place+'</strong> hiela la mayoría de los inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados. Un cultivo sensible a la helada espera hasta después del '+esc(md(s[18]))+', la fecha tardía de helada del modelo meteorológico, y la helada puede llegar más tarde.':'En <strong>'+place+'</strong> hiela la mayoría de los inviernos: la estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados. El modelo meteorológico no tiene fecha de helada allí, así que planta los cultivos sensibles a la helada después de tu propia última helada.'))+'</p>');
      if(stw===1)spring.push('<dl class="facts"><dt>Temporada de cultivo</dt><dd>Todo el año</dd></dl>');
    }else if(free&&some){
      spring.push('<p class="answer">En <strong>'+place+'</strong> hiela algunos inviernos: el modelo meteorológico tuvo helada allí en una cuarta parte o más de sus inviernos, así que un cultivo sensible a la helada espera hasta después del '+esc(md(s[18]))+'. En los cerros, en los valles del interior y en los barrios lejos de la costa, puede helar más seguido de lo que muestra el modelo.</p>');
    }else if(free){
      spring.push('<p class="answer">'+(mw?'Las heladas son raras en <strong>'+place+'</strong>. En un año típico el modelo meteorológico no tiene ninguna helada ahí, así que no hay una fecha de última helada con la que planificar y la temporada de cultivo dura todo el año.':'Las heladas son raras en <strong>'+place+'</strong>. En un año típico esa estación no registra ninguna helada, así que no hay una fecha de última helada con la que planificar y la temporada de cultivo dura todo el año.')+'</p>');
      spring.push('<dl class="facts"><dt>Temporada de cultivo</dt><dd>Todo el año</dd></dl>');
    }else if(most){
      spring.push('<p class="answer">'+(mw?'En <strong>'+place+'</strong> hiela casi todo el año, según los registros del modelo meteorológico. En la mitad de los años la última helada llega a más tardar el <strong>'+esc(md(p50))+'</strong>, pero 1 año de cada 10 todavía hiela después del <strong>'+esc(md(p10))+'</strong>, y el tramo sin heladas dura solo unos '+s[11]+' días.':'En <strong>'+place+'</strong> hiela casi todo el año. En la mitad de los años la última helada llega a más tardar el <strong>'+esc(md(p50))+'</strong>, pero 1 año de cada 10 todavía hiela después del <strong>'+esc(md(p10))+'</strong>, y el tramo sin heladas dura solo unos '+s[11]+' días.')+'</p>');
    }else if(wrap){
      spring.push('<p class="answer">'+(mw?'La helada es rara en <strong>'+place+'</strong>. La temporada de cultivo dura unos '+(s[11]||365)+' días, que es prácticamente todo el año. Las probabilidades del modelo, abajo, se reparten por todo el calendario.':'La helada es rara en <strong>'+place+'</strong>. La temporada de cultivo dura unos '+(s[11]||365)+' días, que es prácticamente todo el año. Las probabilidades registradas abajo se reparten por todo el calendario.')+'</p>');
    }else{
      spring.push('<h2 class="ft-h">¿Cuándo es mi última helada de primavera?</h2>');
      spring.push('<p class="answer">En la mitad de los años, <strong>'+place+'</strong> tiene su última helada de primavera para el <strong>'+esc(md(p50))+'</strong>, pero 1 año de cada 10 todavía hiela después del <strong>'+esc(md(p10))+'</strong>.</p>');
    }
    if(stw&&!free)spring.push('<p>La estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados.'+(sd?' '+(two?(near?'Las fechas son las de la estación meteorológica de '+esc(s[24])+', a '+dist(s[26])+', sacadas de '+s[27]+' años de sus temperaturas mínimas diarias en los registros GHCN-Daily de NOAA. Su registro es el más largo.':'Las fechas son las de la estación meteorológica de '+esc(s[24])+', a '+dist(s[26])+', sacadas de '+s[27]+' años de sus temperaturas mínimas diarias en los registros GHCN-Daily de NOAA. Su registro es el más largo, así que la helada puede llegar más tarde de lo que muestran.'):'Estas fechas de helada son las propias de la estación meteorológica de '+esc(s[24])+', sacadas de '+s[27]+' años de sus temperaturas mínimas diarias en los registros GHCN-Daily de NOAA.'):'')+'</p>');
    if(!free)spring.push('<dl class="facts" id="ft-odds-s"><dt>Hiela así de tarde 1 año de cada 10</dt><dd>'+esc(md(s[5]))+'</dd><dt>1 año de cada 5</dt><dd>'+esc(md(s[6]))+'</dd><dt>3 años de cada 10</dt><dd>'+esc(md(s[7]))+'</dd><dt>2 años de cada 5</dt><dd>'+esc(md(s[8]))+'</dd><dt>La mitad de los años (la mediana)</dt><dd>'+esc(md(s[9]))+'</dd></dl>');
    // The fall side, on exactly the same footing. A station whose table predates the fall
    // percentiles still gets the median it always had, stated as the median and not dressed up as
    // odds; a freeze that straddles the New Year keeps its odds (fw, O238). O188 item 1: a curated site
    // (adj, the app's own terrain-corrected city site) carried its fall freeze as a median only; since O198
    // (milestone 3) it carries the fall odds too, and the median-only wording stays for a table without them.
    var f50=fw(s[10],s),f10=fw(s[12],s),fok=(f50&&f10&&f10<f50);
    if(f50&&!free){
      autumn.push('<h2 class="ft-h">¿Cuándo es mi primera helada de otoño?</h2>');
      if(fok){
        autumn.push('<p class="answer">En la mitad de los años, en <strong>'+place+'</strong> la temporada sigue hasta el <strong>'+esc(md(f50))+'</strong>, pero 1 año de cada 10 la primera helada llega para el <strong>'+esc(md(f10))+'</strong>.</p>');
        autumn.push('<dl class="facts" id="ft-odds-f"><dt>Hiela así de temprano 1 año de cada 10</dt><dd>'+esc(md(f10))+'</dd><dt>1 año de cada 5</dt><dd>'+esc(md(s[13]))+'</dd><dt>3 años de cada 10</dt><dd>'+esc(md(s[14]))+'</dd><dt>2 años de cada 5</dt><dd>'+esc(md(s[15]))+'</dd><dt>La mitad de los años (la mediana)</dt><dd>'+esc(md(f50))+'</dd>'+(s[11]?'<dt>Temporada de cultivo</dt><dd>unos '+s[11]+' días</dd>':'')+'</dl>');
      }else{
        autumn.push('<p class="answer">'+(adj&&!f10?'La primera helada de otoño en <strong>'+place+'</strong> llega alrededor del <strong>'+esc(md(f50))+'</strong> en la mitad de los años. Las fechas corregidas para este lugar solo conservan la mediana, así que es una sola fecha central, sin dispersión. Tómala como una respuesta menos firme que las probabilidades de primavera.':mw?'La primera helada de otoño en <strong>'+place+'</strong> llega alrededor del <strong>'+esc(md(f50))+'</strong> en la mitad de los años. La tabla del modelo meteorológico solo guarda aquí la mediana, así que es una sola fecha central, sin dispersión. Tómala como una respuesta menos firme que las probabilidades de primavera.':'La primera helada de otoño en <strong>'+place+'</strong> llega alrededor del <strong>'+esc(md(f50))+'</strong> en la mitad de los años. Esta estación solo registra la mediana, así que es una sola fecha central, sin dispersión. Tómala como una respuesta menos firme que las probabilidades de primavera.')+'</p>');
        if(s[11])autumn.push('<dl class="facts"><dt>Temporada de cultivo</dt><dd>unos '+s[11]+' días</dd></dl>');
      }
    }
    // O449 M2: a fall side with no median (the first frost comes in fewer than half of years: Adelaide). The ring draws
    // the odds the record holds and labels their dates, so they are listed here too, only the rows it holds
    var fpart=!f50&&!free&&(s[12]||s[13]||s[14]||s[15]);
    if(fpart){
      autumn.push('<h2 class="ft-h">¿Cuándo es mi primera helada de otoño?</h2>');
      autumn.push('<dl class="facts" id="ft-odds-f">'+(s[12]?'<dt>Hiela así de temprano 1 año de cada 10</dt><dd>'+esc(md(s[12]))+'</dd>':'')+(s[13]?'<dt>1 año de cada 5</dt><dd>'+esc(md(s[13]))+'</dd>':'')+(s[14]?'<dt>3 años de cada 10</dt><dd>'+esc(md(s[14]))+'</dd>':'')+(s[15]?'<dt>2 años de cada 5</dt><dd>'+esc(md(s[15]))+'</dd>':'')+'</dl>');
    }
    var fallFirst=false;
    // the reader's month, in their hemisphere: south of the equator the fall freeze comes in the first half of the year
    try{var mo=new Date().getMonth()+1;fallFirst=s[3]<0?mo<=6:(mo>=7&&mo<=12);}catch(e){}
    // the answer's trail (Many doors M3, D-337 point 3), each step carrying the ZIP, or the city's centre, name and
    // country (Answers' placeFromHash): what can go in now there, "When do I plant?" there (the ladder this answer
    // carried, re-labelled, call 4) and where the dates come from (the coverage map, on the city's country; its address
    // is set below). O308 M2's re-walk: it stands right after the first answer, where a gardener asking "when do I
    // plant?" reads; at the foot, under both answers and the sources, it was 3 to 4 screens down. The
    // page's own trail, with the fold of every door, closes the page.
    var pq=w?'at='+w[6].toFixed(4)+','+w[7].toFixed(4)+'&amp;place='+esc(encodeURIComponent(cname(w)))+(w[10]?'&amp;cc='+esc(w[10]):''):'zip='+esc(zs);
    var ladder='<div class="nexttrail"><p class="ladder"><a class="ladder-cta" href="../../web/?lang=es#/answers?situation=now&amp;'+pq+'" data-next="now"><span>¿Qué puedo sembrar ahora?</span> &rsaquo;</a></p>'
      +'<p class="more"><a href="../../web/?lang=es#/answers?'+pq+'" data-next="when">¿Cuándo siembro?</a> &middot; <a class="ft-map" data-next="map">De dónde vienen las fechas</a></p></div>';
    var blocks=fallFirst?autumn.concat(spring):spring.concat(autumn),at=-1;
    for(var i=0;i<blocks.length;i++){if(blocks[i].indexOf('<p class="answer">')===0){at=i;break;}}
    if(at>=0)blocks.splice(at+1,0,ladder);
    // O449 M2: the place's year, once, under the first answer and its next step - where frost sets a season the page
    // itself would draw (the frost pages' rule: a median last frost, and a median season short of the whole year).
    // Its source sentence is the how-sure line's own (yrSrc). A ZIP's says the planner's grade at the ZIP, as the
    // source paragraph below does; a number the lookup answers from inside a station's run with no centroid on its
    // list (a PO-box ZIP: 01014) has no grade of its own, and says the record's own (YG), as the station's page does
    var ringed=at>=0&&!free&&s[9]>0&&s[11]>0&&s[11]<365,rz=zs?reach(parseInt(zs,10)):null,
        src=yrPlaceSrc(s,w,rz);
    if(ringed)blocks.splice(at+2,0,'<div id="ft-yr"></div>');
    // O452 (a), with M3b: where frost is rare the lookup draws the ring the place's own page draws - only where that
    // page's answer says rare, and with the page's own sentence under it (the frost data's YS names which, row by row:
    // yearfig.yr_draws and yr_says_kind decide, never this script)
    var ys=(DATA.YS||{})[DATA.S.indexOf(s)],rare=!ringed&&at>=0&&ys!=null;
    if(rare)blocks.splice(at+2,0,'<div id="ft-yr"></div>');
    h.push(blocks.join(""));
    if(sd){
      // D-363: the station's own dates, how Milpa read them and NCEI's whole citation; then the model's line beside them
      h.push('<p class="prov"><strong>Las fechas de helada son de una estación meteorológica.</strong> Salen de los registros diarios GHCN-Daily de NOAA para la estación de '+esc(s[24])+' ('+esc(s[25])+'), a '+dist(s[26])+' de '+city+': Milpa leyó sus temperaturas mínimas diarias de 1991 a 2020 y, en cada uno de los '+s[27]+' años que registró completos, la última noche de primavera y la primera noche de otoño a 0&nbsp;°C (32&nbsp;°F) o menos.</p>');
      h.push('<p class="prov">Conteos y fechas de helada de <a href="https://doi.org/10.7289/V5D21VHZ">GHCN-Daily</a>, versión 3.35-upd-2026101817, de los Centros Nacionales de Información Ambiental de NOAA (NCEI), citados como pide NCEI: <span class="cite" lang="en">Menne, Matthew J., Imke Durre, Bryant Korzeniewski, Shelley McNeill, Kristy Thomas, Xungang Yin, Steven Anthony, Ron Ray, Russell S. Vose, Byron E.Gleason, and Tamara G. Houston (2012): Global Historical Climatology Network - Daily (GHCN-Daily), Version 3. Daily minimum temperature (TMIN), stations outside the United States, 1991-2020. NOAA National Climatic Data Center. doi:10.7289/V5D21VHZ. Accessed 2026-10-20.</span></p>');
      h.push('<p class="prov">Una estación meteorológica mide un solo lugar, así que el terreno a su alrededor puede ser distinto: una hondonada donde se acumula la helada, una ladera, la orilla de un lago, el calor propio de una ciudad. El planificador de Milpa lee estas mismas fechas para un huerto de aquí y les da la calificación '+GW[w[9]]+'.</p>');
      if(s[28]||s[30])h.push('<p class="prov">'+(s[28]?'Las fechas del modelo meteorológico para '+city+': última helada hacia el '+esc(md(s[28]))+'.':s[29]?'El modelo meteorológico no tiene una fecha mediana de última helada para '+city+': vio una helada en '+s[29]+' de '+s[30]+' inviernos.':'El modelo meteorológico no tiene una fecha mediana de última helada para '+city+': no vio ninguna helada en sus '+s[30]+' inviernos.')+'</p>');
      h.push('<p class="prov"><strong>El modelo meteorológico, para comparar.</strong> Sus fechas de helada para '+city+' salen de ERA5, una reconstrucción del tiempo de todo el mundo de 1991 a 2020 hecha por el ECMWF, la agencia europea de previsión meteorológica a plazo medio, para el programa Copernicus de la UE, y leída aquí a través de Open-Meteo: sus temperaturas mínimas diarias para el punto en '+lat+', '+lon+', a '+dist(w[8])+' del centro de '+city+'.</p>');
      h.push('<p class="prov">Datos meteorológicos de <a href="https://open-meteo.com/">Open-Meteo.com</a>, con licencia <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Contiene información modificada del Servicio de Cambio Climático de Copernicus, 2026.</p>');
    }else if(model){
      h.push('<p class="prov"><strong>Calculado con un modelo, no medido.</strong> Ninguna estación meteorológica respalda estas fechas. Salen de ERA5, una reconstrucción del tiempo de todo el mundo de 1991 a 2020 hecha por el ECMWF, la agencia europea de previsión meteorológica a plazo medio, para el programa Copernicus de la UE, y leída aquí a través de Open-Meteo. Son las temperaturas mínimas diarias del modelo para el punto en '+lat+', '+lon+', a '+dist(w[8])+' del centro de '+city+'. Aquí, helada significa una mínima de 0&nbsp;°C (32&nbsp;°F) o menos.</p>');
      h.push('<p class="prov">Un modelo meteorológico ve el terreno en cuadros de unos 25&nbsp;km (16 millas) de lado, así que puede pasar por alto lo que distingue un huerto del siguiente: una hondonada donde se acumula la helada, una ladera, la orilla de un lago, el calor propio de una ciudad. El planificador de Milpa lee estos mismos números para un huerto de aquí y les da la calificación '+GW[w[9]]+'.</p>');
      h.push('<p class="prov">Datos meteorológicos de <a href="https://open-meteo.com/">Open-Meteo.com</a>, con licencia <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Contiene información modificada del Servicio de Cambio Climático de Copernicus, 2026.</p>');
    }else{
      h.push('<p class="prov">'+(adj?'Estas son las normales de 1991&ndash;2020 de la estación '+nm+' ('+esc(s[2])+') de la NOAA, trasladadas '+s[18]+' km hasta '+lat+', '+lon+' y corregidas según el terreno con los mapas de temperatura de PRISM. El planificador de Milpa usa estas mismas fechas aquí. Cuanto más lejos esté tu huerto de ese punto, menos fielmente describen tu terreno. Además, el aire frío se acumula en las zonas bajas en las noches despejadas y en calma en que hiela, así que una hondonada puede helarse mientras una ladera cercana no. Ninguna tabla puede saber eso de tu terreno, pero las heladas que registres durante unas cuantas temporadas sí pueden.':'Estas son las normales registradas de 1991&ndash;2020 en la estación '+nm+' ('+esc(s[2])+') de la NOAA, en '+lat+', '+lon+'. Son los registros propios de esa estación, sin ajustes. Cuanto más lejos esté tu huerto de ella, con menos exactitud describen tu terreno. Además, el aire frío se acumula en las zonas bajas en las noches despejadas y en calma en que hiela, así que una hondonada puede helarse mientras una ladera cercana no. Ninguna tabla puede saber eso de tu terreno, pero las heladas que registres durante unas cuantas temporadas sí pueden.')+'</p>');
      var r=zs?reach(parseInt(zs,10)):null;
      if(r)h.push('<p class="prov">'+(adj?'El centro del código postal '+esc(zs)+' está a '+dist(r[0])+' de ese punto, y allí el planificador de Milpa les da a estas fechas la calificación '+GW[r[1]]+'.':'El centro del código postal '+esc(zs)+' está a '+dist(r[0])+' de la estación, y allí el planificador de Milpa les da a estas fechas la calificación '+GW[r[1]]+'.')+'</p>');
    }
    h.push('<p class="prov">Esto es el <em>calendario</em> de tus heladas, que es aparte de tu zona de rusticidad. La zona te dice qué perennes sobreviven a tu invierno, y estas probabilidades te dicen cuándo es seguro trasplantar tomates. Salen de datos distintos, y una herramienta que te da una citando la otra está adivinando.</p>');
    if(at<0)h.push(ladder); // no answer paragraph to follow: the door keeps its old place
    if(w)h.push('<p class="more"><a class="ft-city">La página de heladas de '+city+' &rsaquo;</a></p>');
    // the place's own page, straight to its summer section, where it has one (P: the fix batch, the maintainer's review
    // of Water) - "Summer and rain" once the page holds its rain (1), a world city's dry months from rain gauges (2,
    // D-296), "Summer heat" with its highs alone (0)
    var pg=DATA.P&&DATA.P[s[2]];
    if(pg)h.push('<p class="more"><a class="ft-summer">'+(pg[1]===1?'Calor de verano y lluvia en '+nm+', mes a mes &rsaquo;':pg[1]===2?'Calor de verano y meses secos en '+nm+' &rsaquo;':'Calor de verano en '+nm+', mes a mes &rsaquo;')+'</a></p>');
    // O399 (b): the place the monthly note's sign-up names, kept as still-time-core.js placeKey and placeName keep it
    out.ggNote={key:w?"city:"+w[6].toFixed(4)+","+w[7].toFixed(4):"zip:"+zs,name:w?cname(w)+", "+ctry(w):s[0]+", "+s[1]};
    out.innerHTML=h.join("");
    // O449 M3b: the place is kept on this device for the pages that draw a year (the feed's yrRemember), and a reader
    // who came from one is offered the way back to it, now drawn for this place
    yrRemember(DATA,s,w,zs,rz);yrBack(out);
    yrDraw=ringed?function(){var el=document.getElementById("ft-yr");if(el&&!el.firstChild)el.innerHTML=yrFigure(s,place,src,"ft-odds-s"+(fok||fpart?" ft-odds-f":""));}
      :rare?function(){var el=document.getElementById("ft-yr");if(el&&!el.firstChild)el.innerHTML=yrFigure(s,place,src,
        ["ft-odds-s","ft-odds-f"].filter(function(i){return document.getElementById(i);}).join(" "),{says:["El trazo verde recorre todo el año: el registro de aquí no tiene ninguna helada que dibujar.","El trazo verde recorre todo el año: en más de la mitad de los años aquí no hiela.","El trazo verde recorre todo el año: en más de la mitad de los años aquí no hiela. Las marcas son los años en que sí."][ys]});}:null;
    if(yrDraw){yrDraw();yrLoad();}
    // set here, not written into the markup above: the site's link check reads every href on the page, a
    // script's too, and a composed one would read as dead. The same path holds on the Spanish page (its twin).
    if(w)out.querySelector(".ft-city").setAttribute("href","../frost/"+w[5]+"/");
    out.querySelector(".ft-map").setAttribute("href","../coverage/"+(w&&w[10]?"?country="+w[10]:"")+"#map");
    if(pg)out.querySelector(".ft-summer").setAttribute("href","../frost/"+pg[0]+"/#summer");
  }
  // The cities on the list a name matches: exactly (one answers at once; two of one name are offered), or by how
  // they begin, offered to choose from - never answered from a guess, as Bern must not get Berlin's dates.
  function cities(q){
    var ex=[],near=[];
    for(var i=0;i<DATA.W.length;i++){var w=DATA.W[i],keys=[fold(w[0]),fold(w[1]),fold(w[0]+" "+w[2]),fold(w[1]+" "+w[3])];
      if(keys.indexOf(q)>=0)ex.push(i);else if(near.length<8&&keys.some(function(k){return k.indexOf(q)===0;}))near.push(i);}
    return ex.length?ex:near.length?{near:near}:[];
  }
  function go(){
    var raw=inp.value||"";
    if(!/[^0-9\s-]/.test(raw)){
      var v=raw.replace(/[^0-9]/g,"").slice(0,5);
      if(v!==raw)inp.value=v;
      if(v.length!==5){out.innerHTML="";return;}
    }else if(fold(raw).length<2){out.innerHTML="";return;}
    if(!DATA){pending=1;out.innerHTML='<p class="ft-empty">Buscando&hellip;</p>';load();return;}
    if(v){render(v);return;}
    var q=fold(raw),m=cities(q),query=esc(raw.trim());
    if(m.length===1){answer(DATA.S[DATA.W[m[0]][4]],DATA.W[m[0]]);return;}
    var pick=m.near||m;
    if(pick.length){out.innerHTML='<p class="ft-empty">¿Qué ciudad quieres decir?</p><ul class="ft-choices">'+pick.map(function(i){var w=DATA.W[i];
      return '<li><button type="button" class="btn btn-secondary ft-choice" data-w="'+i+'">'+esc(cname(w))+", "+esc(ctry(w))+'</button></li>';}).join("")+'</ul>';return;}
    out.innerHTML=q.length<3?"":'<p class="ft-empty"><strong>'+query+'</strong> no tiene página de heladas aquí. En EE. UU., escribe tu código postal. Fuera de EE. UU., cada una de las 454 ciudades de 1,000,000 habitantes o más tiene la suya, y se encuentra por su nombre en inglés o en español. La <a href="../../web/?lang=es">app de Milpa</a> conoce por su nombre 2,801 ciudades de 100,000 habitantes o más, busca cualquier otro lugar, y calcula las fechas de helada de tu propio huerto dondequiera que lleguen los datos. '+('<a class="btn btn-secondary ft-find" href="../../web/?lang=es#/answers?q='+encodeURIComponent(raw.trim())+'">'+'Buscar «'+query+'» en la app ›'+'</a>')+'</p>';
  }
  out.addEventListener("click",function(e){
    var b=e.target&&e.target.closest?e.target.closest(".ft-choice"):null;if(!b||!DATA)return;
    var w=DATA.W[+b.getAttribute("data-w")];inp.value=cname(w)+", "+ctry(w);answer(DATA.S[w[4]],w);
  });
  inp.addEventListener("focus",load);
  inp.addEventListener("input",go);
  // D-342 point 1: this script arrives after the field is first used (the frost home's loader fetches it on focus, on
  // input or for ?zip=), so it answers what is already typed, and starts the data on its way for a field in focus
  try{var m=(location.search.match(/[?&]zip=(\d{5})/)||[])[1];if(m){inp.value=m;go();}else if(inp.value)go();else if(document.activeElement===inp)load();}catch(e){}
})();
