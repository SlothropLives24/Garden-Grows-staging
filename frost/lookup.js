
(function(){
  var MON=["January","February","March","April","May","June","July","August","September","October","November","December"];
  var CUM=[0,31,59,90,120,151,181,212,243,273,304,334];
  function md(doy){if(doy>365)doy-=365;var m=11;while(m>0&&CUM[m]>=doy)m--;return MON[m]+" "+(doy-CUM[m]);}
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
  var L=0,GW={"A":"<span class=\"conf gA\">Well established</span>","B":"<span class=\"conf gB\">Promising</span>","C":"<span class=\"conf gC\">A good hunch</span>"};
  function fold(t){return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  function cname(w){return w[L]||w[0];}
  function ctry(w){return w[2+L]||w[2];}
  function dist(k){return k<2?"less than 2 km (about a mile)":Math.round(k/1.609344)<2?""+Math.round(k)+" km (about a mile)":""+Math.round(k)+" km ("+Math.round(k/1.609344)+" miles)";}
  var inp=document.getElementById("ft-zip"),out=document.getElementById("ft-out");
  if(!inp||!out)return;
  var DATA=null,loading=false,pending=null;
  function load(){
    if(DATA||loading)return;loading=true;
    fetch("data.json").then(function(r){return r.json();}).then(function(d){
      var F=d.Fd.slice();for(var i=1;i<F.length;i++)F[i]=F[i]+F[i-1];d.F=F;
      var Z=(d.Z||[]).slice();for(var j=1;j<Z.length;j++)Z[j]=Z[j]+Z[j-1];d.Zs=Z;DATA=d;loading=false;
      if(pending!=null){pending=null;go();}
    }).catch(function(){loading=false;out.innerHTML='<p class="ft-empty">The frost data could not be loaded. Browse <a href="#us-list">frost dates by location</a> instead.</p>';});
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
  // One chart for both seasons (O105a). `fall` flips two things and nothing else: which side of the
  // median the risk sits on, and which way the key label anchors. Spring risk runs LATE (a frost
  // after the median), fall risk runs EARLY (a freeze before it), so the safe band is on the right
  // in spring and on the left in autumn - and in both, p10 is the year in ten that catches you.
  function bandSVG(s,fall,nm){
    var p10=fall?fw(s[12],s):s[5],p20=fall?fw(s[13],s):s[6],p30=fall?fw(s[14],s):s[7],p40=fall?fw(s[15],s):s[8],
        p50=fall?fw(s[10],s):s[9];
    if(!p50||!p10)return "";
    var vals=[p10,p20,p30,p40,p50].filter(function(v){return v;});
    var lo=Math.min.apply(null,vals)-12,hi=Math.max.apply(null,vals)+12;
    var W=340,H=132,ml=16,mr=16,innerW=W-ml-mr,barY=74,barH=22;
    function n(v){return Math.round(v*100)/100;}
    function x(d){return n(ml+(d-lo)/(hi-lo)*innerW);}
    var o=['<svg class="ff-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+(fall?"First fall freeze":"Last spring frost")+' odds for '+nm+'">'];
    if(fall){
      o.push('<rect class="ff-band ff-safe" x="'+x(lo)+'" y="'+barY+'" width="'+n(x(p10)-x(lo))+'" height="'+barH+'"/>');
      o.push('<rect class="ff-band ff-gamble" x="'+x(p10)+'" y="'+barY+'" width="'+n(x(p50)-x(p10))+'" height="'+barH+'"/>');
      o.push('<rect class="ff-band ff-risk" x="'+x(p50)+'" y="'+barY+'" width="'+n(x(hi)-x(p50))+'" height="'+barH+'"/>');
    }else{
      o.push('<rect class="ff-band ff-risk" x="'+x(lo)+'" y="'+barY+'" width="'+n(x(p50)-x(lo))+'" height="'+barH+'"/>');
      o.push('<rect class="ff-band ff-gamble" x="'+x(p50)+'" y="'+barY+'" width="'+n(x(p10)-x(p50))+'" height="'+barH+'"/>');
      o.push('<rect class="ff-band ff-safe" x="'+x(p10)+'" y="'+barY+'" width="'+n(x(hi)-x(p10))+'" height="'+barH+'"/>');
    }
    [p40,p30,p20].forEach(function(d){if(d)o.push('<line class="ff-mid" x1="'+x(d)+'" y1="'+barY+'" x2="'+x(d)+'" y2="'+n(barY+barH)+'"/>');});
    for(var k=0;k<24;k++){var mm=k%12+1,d=CUM[mm-1]+1+(k<12?0:365);if(lo<=d&&d<=hi){o.push('<line class="ff-month" x1="'+x(d)+'" y1="'+barY+'" x2="'+x(d)+'" y2="'+n(barY+barH+5)+'"/>');o.push('<text class="ff-mlab" x="'+x(d)+'" y="'+n(barY+barH+16)+'">'+MON[mm-1].slice(0,3)+'</text>');}}
    function key(d,top,dl,anc,up){return '<line class="ff-key-tick" x1="'+x(d)+'" y1="'+n(barY-8-up)+'" x2="'+x(d)+'" y2="'+n(barY+barH)+'"/><text class="ff-key" x="'+x(d)+'" y="'+n(barY-24-up)+'" text-anchor="'+anc+'">'+top+'</text><text class="ff-keyd" x="'+x(d)+'" y="'+n(barY-11-up)+'" text-anchor="'+anc+'">'+dl+'</text>';}
    // O175 M4 (the M4 audit, M3): close dates ran the two labels together ("Medianal año de cada 10"), so the
    // 1-in-10 label lifts a row when the gap is under the labels' width (figures.key_room's sum)
    var med="Median",ten="1 year in 10",room=(med.length/2+ten.length)*6.2+6;
    o.push(key(p50,med,esc(md(p50)),"middle",0));
    o.push(key(p10,ten,esc(md(p10)),fall?"start":"end",Math.abs(x(p10)-x(p50))<room?26:0));
    o.push("</svg>");
    return o.join("");
  }
  function render(zs){
    var s=lookup(parseInt(zs,10));
    // O194 (21): a listed ZIP far from every station is told so; any other miss is not a ZIP we know
    if(!s){out.innerHTML=(DATA.X||[]).indexOf(parseInt(zs,10))>=0?'<p class="ft-empty">No NOAA station sits near ZIP '+esc(zs)+'. Browse the <a href="#us-list">closest listed locations</a> instead.</p>':'<p class="ft-empty">ZIP '+esc(zs)+' isn&rsquo;t a US ZIP code we know. Check the number, or browse the <a href="#us-list">closest listed locations</a>.</p>';return;}
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
    // the calendar the tail comes numerically BEFORE the median. The spring-window bar assumes a
    // clean spring and would draw nonsense, so for these we say the honest thing instead of a chart.
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
      spring.push('<p class="answer">'+(stw===1?(s[22]?'Frost is rare at <strong>'+place+'</strong>. The '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record, so there is no last-frost date to plan around and the growing season runs all year.':'Frost is rare at <strong>'+place+'</strong>. The '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded no frost in its '+s[23]+' winters on record, so the growing season runs all year.'):sd?(stw===2?(some?(two?(near?'Frost comes in some winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record, so a frost-tender crop waits until after '+esc(md(s[18]))+', the late frost date of the '+esc(s[24])+' weather station, '+dist(s[26])+' away. That station has the longer record.':'Frost comes in some winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record, so a frost-tender crop waits until after '+esc(md(s[18]))+', the late frost date of the '+esc(s[24])+' weather station, '+dist(s[26])+' away. That station has the longer record, so frost can come later than that.'):'Frost comes in some winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record, so a frost-tender crop waits until after '+esc(md(s[18]))+', the station’s own late frost date.'):'Frost comes in some winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record. The '+esc(s[24])+' weather station’s frost dates give no late frost date to wait for there, so plant frost-tender crops after your own last frost.'):(some?(two?(near?'Frost comes in most winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record. A frost-tender crop waits until after '+esc(md(s[18]))+', the late frost date of the '+esc(s[24])+' weather station, '+dist(s[26])+' away. That station has the longer record.':'Frost comes in most winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record. A frost-tender crop waits until after '+esc(md(s[18]))+', the late frost date of the '+esc(s[24])+' weather station, '+dist(s[26])+' away. That station has the longer record, so frost can come later than that.'):'Frost comes in most winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record. A frost-tender crop waits until after '+esc(md(s[18]))+', the station’s own late frost date, and frost can come later than that.'):'Frost comes in most winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record. The '+esc(s[24])+' weather station’s frost dates give no late frost date to wait for there, so plant frost-tender crops after your own last frost.')):stw===2?(some?'Frost comes in some winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record, so a frost-tender crop waits until after '+esc(md(s[18]))+', the weather model’s late frost date.':'Frost comes in some winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record. The weather model has no frost date there, so plant frost-tender crops after your own last frost.'):(some?'Frost comes in most winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record. A frost-tender crop waits until after '+esc(md(s[18]))+', the weather model’s late frost date, and frost can come later than that.':'Frost comes in most winters at <strong>'+place+'</strong>: the '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record. The weather model has no frost date there, so plant frost-tender crops after your own last frost.'))+'</p>');
      if(stw===1)spring.push('<dl class="facts"><dt>Growing season</dt><dd>All year</dd></dl>');
    }else if(free&&some){
      spring.push('<p class="answer">Frost comes in some winters at <strong>'+place+'</strong>: the weather model had a frost there in a quarter or more of its winters, so a frost-tender crop waits until after '+esc(md(s[18]))+'. In hills, inland valleys and suburbs away from the coast, frost can come more often than the model shows.</p>');
    }else if(free){
      spring.push('<p class="answer">'+(mw?'Frost is rare at <strong>'+place+'</strong>. In a typical year the weather model has no freeze there at all, so there is no last-frost date to plan around and the growing season runs all year.':'Frost is rare at <strong>'+place+'</strong>. In a typical year the station there records no freeze at all, so there is no last-frost date to plan around and the growing season runs all year.')+'</p>');
      spring.push('<dl class="facts"><dt>Growing season</dt><dd>All year</dd></dl>');
    }else if(most){
      spring.push('<p class="answer">'+(mw?'Frost comes most of the year at <strong>'+place+'</strong>, by the weather model&rsquo;s records. Half of years have their last frost by <strong>'+esc(md(p50))+'</strong>, but 1 year in 10 it still frosts after <strong>'+esc(md(p10))+'</strong>, and the frost-free stretch is only about '+s[11]+' days.':'Frost comes most of the year at <strong>'+place+'</strong>. Half of years have their last frost by <strong>'+esc(md(p50))+'</strong>, but 1 year in 10 it still frosts after <strong>'+esc(md(p10))+'</strong>, and the frost-free stretch is only about '+s[11]+' days.')+'</p>');
    }else if(wrap){
      spring.push('<p class="answer">'+(mw?'Frost is rare at <strong>'+place+'</strong>. The growing season runs about '+(s[11]||365)+' days, which is effectively year-round. The model&rsquo;s odds below are spread across the whole calendar.':'Frost is rare at <strong>'+place+'</strong>. The growing season runs about '+(s[11]||365)+' days, which is effectively year-round. The recorded odds below are spread across the whole calendar.')+'</p>');
    }else{
      spring.push('<h2 class="ft-h">When is my last spring frost?</h2>');
      spring.push('<p class="answer">Half of years at <strong>'+place+'</strong> have their last spring frost by <strong>'+esc(md(p50))+'</strong>, but 1 year in 10 it still frosts after <strong>'+esc(md(p10))+'</strong>.</p>');
      spring.push('<figure class="frostfig"><div class="ff-frame">'+bandSVG(s,false,nm)+'</div><ul class="ff-legend"><li><span class="ff-dot ff-risk"></span>frost most years</li><li><span class="ff-dot ff-gamble"></span>frost in some years (the gamble)</li><li><span class="ff-dot ff-safe"></span>frost rare (about 1 year in 10)</li></ul></figure>');
    }
    if(stw&&!free)spring.push('<p>The '+esc(s[20])+' weather station, '+dist(s[21])+' away, recorded a frost in '+s[22]+' of its '+s[23]+' winters on record.'+(sd?' '+(two?(near?'The dates are the '+esc(s[24])+' weather station’s, '+dist(s[26])+' away, from '+s[27]+' years of its daily lows in NOAA’s GHCN-Daily records. It has the longer record.':'The dates are the '+esc(s[24])+' weather station’s, '+dist(s[26])+' away, from '+s[27]+' years of its daily lows in NOAA’s GHCN-Daily records. It has the longer record, so frost can come later than they show.'):'These frost dates are the '+esc(s[24])+' weather station’s own, from '+s[27]+' years of its daily lows in NOAA’s GHCN-Daily records.'):'')+'</p>');
    if(!free)spring.push('<dl class="facts"><dt>Frost this late in 1 year in 10</dt><dd>'+esc(md(s[5]))+'</dd><dt>1 year in 5</dt><dd>'+esc(md(s[6]))+'</dd><dt>3 years in 10</dt><dd>'+esc(md(s[7]))+'</dd><dt>2 years in 5</dt><dd>'+esc(md(s[8]))+'</dd><dt>Half of years (the median)</dt><dd>'+esc(md(s[9]))+'</dd></dl>');
    // The fall side, on exactly the same footing. A station whose table predates the fall
    // percentiles still gets the median it always had, stated as the median and not dressed up as
    // odds; a freeze that straddles the New Year keeps its odds (fw, O238). O188 item 1: a curated site
    // (adj, the app's own terrain-corrected city site) carried its fall freeze as a median only; since O198
    // (milestone 3) it carries the fall odds too, and the median-only wording stays for a table without them.
    var f50=fw(s[10],s),f10=fw(s[12],s),fok=(f50&&f10&&f10<f50);
    if(f50&&!free){
      autumn.push('<h2 class="ft-h">When is my first fall freeze?</h2>');
      if(fok){
        autumn.push('<p class="answer">Half of years at <strong>'+place+'</strong> keep going until <strong>'+esc(md(f50))+'</strong>, but 1 year in 10 the first freeze arrives by <strong>'+esc(md(f10))+'</strong>.</p>');
        autumn.push('<figure class="frostfig"><div class="ff-frame">'+bandSVG(s,true,nm)+'</div><ul class="ff-legend"><li><span class="ff-dot ff-safe"></span>freeze rare this early (about 1 year in 10)</li><li><span class="ff-dot ff-gamble"></span>freeze in some years (the gamble)</li><li><span class="ff-dot ff-risk"></span>freeze by now most years</li></ul></figure>');
        autumn.push('<dl class="facts"><dt>Freeze this early in 1 year in 10</dt><dd>'+esc(md(f10))+'</dd><dt>1 year in 5</dt><dd>'+esc(md(s[13]))+'</dd><dt>3 years in 10</dt><dd>'+esc(md(s[14]))+'</dd><dt>2 years in 5</dt><dd>'+esc(md(s[15]))+'</dd><dt>Half of years (the median)</dt><dd>'+esc(md(f50))+'</dd>'+(s[11]?'<dt>Growing season</dt><dd>about '+s[11]+' days</dd>':'')+'</dl>');
      }else{
        autumn.push('<p class="answer">'+(adj&&!f10?'The first fall freeze at <strong>'+place+'</strong> comes around <strong>'+esc(md(f50))+'</strong> in half of years. The corrected dates for this spot keep only the median, so this is a single middle date with no spread. Treat it as less of an answer than the spring odds.':mw?'The first fall freeze at <strong>'+place+'</strong> comes around <strong>'+esc(md(f50))+'</strong> in half of years. The weather model&rsquo;s table here keeps only the median, so this is a single middle date with no spread. Treat it as less of an answer than the spring odds.':'The first fall freeze at <strong>'+place+'</strong> comes around <strong>'+esc(md(f50))+'</strong> in half of years. Only the median is recorded for this station, so this is a single middle date with no spread. Treat it as less of an answer than the spring odds.')+'</p>');
        if(s[11])autumn.push('<dl class="facts"><dt>Growing season</dt><dd>about '+s[11]+' days</dd></dl>');
      }
    }
    var fallFirst=false;
    // the reader's month, in their hemisphere: south of the equator the fall freeze comes in the first half of the year
    try{var mo=new Date().getMonth()+1;fallFirst=s[3]<0?mo<=6:(mo>=7&&mo<=12);}catch(e){}
    // the answer's trail (Many doors M3, D-337 point 3), each step carrying the ZIP, or the city's centre, name and
    // country (Answers' placeFromHash): what can go in now there, "When do I plant?" there (the ladder this answer
    // carried, re-labelled, call 4) and where the dates come from (the coverage map, on the city's country; its address
    // is set below). O308 M2's re-walk: it stands right after the first answer, where a gardener asking "when do I
    // plant?" reads; at the foot, under both answers, their charts and the sources, it was 3 to 4 screens down. The
    // page's own trail, with the fold of every door, closes the page.
    var pq=w?'at='+w[6].toFixed(4)+','+w[7].toFixed(4)+'&amp;place='+esc(encodeURIComponent(cname(w)))+(w[10]?'&amp;cc='+esc(w[10]):''):'zip='+esc(zs);
    var ladder='<div class="nexttrail"><p class="ladder"><a class="ladder-cta" href="../web/#/answers?situation=now&amp;'+pq+'" data-next="now"><span>What can I plant now?</span> &rsaquo;</a></p>'
      +'<p class="more"><a href="../web/#/answers?'+pq+'" data-next="when">When do I plant?</a> &middot; <a class="ft-map" data-next="map">Where the dates come from</a></p></div>';
    var blocks=fallFirst?autumn.concat(spring):spring.concat(autumn),at=-1;
    for(var i=0;i<blocks.length;i++){if(blocks[i].indexOf('<p class="answer">')===0){at=i;break;}}
    if(at>=0)blocks.splice(at+1,0,ladder);
    h.push(blocks.join(""));
    if(sd){
      // D-363: the station's own dates, how Milpa read them and NCEI's whole citation; then the model's line beside them
      h.push('<p class="prov"><strong>The frost dates are a weather station’s.</strong> They come from NOAA’s GHCN-Daily daily records for the '+esc(s[24])+' station ('+esc(s[25])+'), '+dist(s[26])+' from '+city+': Milpa read its daily lows for 1991 to 2020 and, in each of the '+s[27]+' years it recorded in full, the last spring night and the first fall night at or below 0&nbsp;°C (32&nbsp;°F).</p>');
      h.push('<p class="prov">Frost counts and dates from <a href="https://doi.org/10.7289/V5D21VHZ">GHCN-Daily</a>, version 3.35-upd-2026101817, NOAA National Centers for Environmental Information, cited as NCEI asks: <span class="cite" lang="en">Menne, Matthew J., Imke Durre, Bryant Korzeniewski, Shelley McNeill, Kristy Thomas, Xungang Yin, Steven Anthony, Ron Ray, Russell S. Vose, Byron E.Gleason, and Tamara G. Houston (2012): Global Historical Climatology Network - Daily (GHCN-Daily), Version 3. Daily minimum temperature (TMIN), stations outside the United States, 1991-2020. NOAA National Climatic Data Center. doi:10.7289/V5D21VHZ. Accessed 2026-10-20.</span></p>');
      h.push('<p class="prov">A weather station measures one spot, so the ground around it can differ: a frost hollow, a hillside, a lakeshore, a city’s own warmth. The Milpa planner reads these same dates for a garden here and grades them '+GW[w[9]]+'.</p>');
      if(s[28]||s[30])h.push('<p class="prov">'+(s[28]?'The weather model’s dates for '+city+': last frost around '+esc(md(s[28]))+'.':s[29]?'The weather model has no median last frost for '+city+': it saw a frost in '+s[29]+' of '+s[30]+' winters.':'The weather model has no median last frost for '+city+': it saw no frost in its '+s[30]+' winters.')+'</p>');
      h.push('<p class="prov"><strong>The weather model, for comparison.</strong> Its frost dates for '+city+' come from ERA5, a reconstruction of the world’s weather from 1991 to 2020 made by ECMWF, Europe’s medium-range weather forecasting agency, for the EU’s Copernicus program, and read here through Open-Meteo: its daily lows for the point at '+lat+', '+lon+', '+dist(w[8])+' from the center of '+city+'.</p>');
      h.push('<p class="prov">Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a>, under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Contains modified Copernicus Climate Change Service information, 2026.</p>');
    }else if(model){
      h.push('<p class="prov"><strong>Modeled, not measured.</strong> No weather station stands behind these dates. They come from ERA5, a reconstruction of the world’s weather from 1991 to 2020 made by ECMWF, Europe’s medium-range weather forecasting agency, for the EU’s Copernicus program, and read here through Open-Meteo. They are the model’s daily lows for the point at '+lat+', '+lon+', '+dist(w[8])+' from the center of '+city+'. A frost here means a low at or below 0&nbsp;°C (32&nbsp;°F).</p>');
      h.push('<p class="prov">A weather model sees the land in squares about 25&nbsp;km (16 miles) across, so it can miss what sets one garden apart from the next: a frost hollow, a hillside, a lakeshore, a city’s own warmth. The Milpa planner reads these same numbers for a garden here and grades them '+GW[w[9]]+'.</p>');
      h.push('<p class="prov">Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a>, under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Contains modified Copernicus Climate Change Service information, 2026.</p>');
    }else{
      h.push('<p class="prov">'+(adj?'These are the 1991&ndash;2020 normals of NOAA station '+nm+' ('+esc(s[2])+'), carried '+s[18]+' km to '+lat+', '+lon+' with a terrain correction from PRISM temperature maps. The Milpa planner uses these same dates here. The further your garden is from that point, the less exactly they describe your ground. Cold air also pools in low spots on the clear, still nights when frost happens, so a hollow can freeze while a slope nearby does not. No table can know that about your yard, but a few seasons of your own logged frosts can.':'These are the recorded 1991&ndash;2020 normals at NOAA station '+nm+' ('+esc(s[2])+'), at '+lat+', '+lon+'. They are that station’s own records, unshifted. The further your garden is from it, the less exactly they describe your ground. Cold air also pools in low spots on the clear, still nights when frost happens, so a hollow can freeze while a slope nearby does not. No table can know that about your yard, but a few seasons of your own logged frosts can.')+'</p>');
      var r=zs?reach(parseInt(zs,10)):null;
      if(r)h.push('<p class="prov">'+(adj?'The center of ZIP '+esc(zs)+' is '+dist(r[0])+' from that point, and the Milpa planner grades these dates '+GW[r[1]]+' there.':'The center of ZIP '+esc(zs)+' is '+dist(r[0])+' from the station, and the Milpa planner grades these dates '+GW[r[1]]+' there.')+'</p>');
    }
    h.push('<p class="prov">This is your frost <em>timing</em>, which is separate from your hardiness zone. The zone tells you which perennials survive your winter, and these odds tell you when it&rsquo;s safe to set out tomatoes. They come from different data, and a tool that gives you one by quoting the other is guessing.</p>');
    if(at<0)h.push(ladder); // no answer paragraph to follow: the door keeps its old place
    if(w)h.push('<p class="more"><a class="ft-city">'+city+'&rsquo;s frost page &rsaquo;</a></p>');
    // the place's own page, straight to its summer section, where it has one (P: the fix batch, the maintainer's review
    // of Water) - "Summer and rain" once the page holds its rain (1), a world city's dry months from rain gauges (2,
    // D-296), "Summer heat" with its highs alone (0)
    var pg=DATA.P&&DATA.P[s[2]];
    if(pg)h.push('<p class="more"><a class="ft-summer">'+(pg[1]===1?''+nm+'&rsquo;s summer heat and rain, month by month &rsaquo;':pg[1]===2?''+nm+'&rsquo;s summer heat and dry months &rsaquo;':''+nm+'&rsquo;s summer heat, month by month &rsaquo;')+'</a></p>');
    out.innerHTML=h.join("");
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
    if(!DATA){pending=1;out.innerHTML='<p class="ft-empty">Looking that up&hellip;</p>';load();return;}
    if(v){render(v);return;}
    var q=fold(raw),m=cities(q),query=esc(raw.trim());
    if(m.length===1){answer(DATA.S[DATA.W[m[0]][4]],DATA.W[m[0]]);return;}
    var pick=m.near||m;
    if(pick.length){out.innerHTML='<p class="ft-empty">Which city do you mean?</p><ul class="ft-choices">'+pick.map(function(i){var w=DATA.W[i];
      return '<li><button type="button" class="btn btn-secondary ft-choice" data-w="'+i+'">'+esc(cname(w))+", "+esc(ctry(w))+'</button></li>';}).join("")+'</ul>';return;}
    out.innerHTML=q.length<3?"":'<p class="ft-empty"><strong>'+query+'</strong> has no frost page here. In the US, type your ZIP code instead. Outside the US, the 454 cities of 1,000,000 people or more each have one, found by their names in English or Spanish. The <a href="../web/">Milpa app</a> knows 2,801 cities of 100,000 people or more by name, looks up any other town, and works out your own garden&rsquo;s frost dates wherever the data reaches. '+('<a class="btn btn-secondary ft-find" href="../web/#/answers?q='+encodeURIComponent(raw.trim())+'">'+'Look up “'+query+'” in the app ›'+'</a>')+'</p>';
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
