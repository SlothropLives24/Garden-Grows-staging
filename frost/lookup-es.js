
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
  var L=1,GW={"A":"<span class=\"conf gA\">Bien establecido</span>","B":"<span class=\"conf gB\">Prometedor</span>","C":"<span class=\"conf gC\">Una buena corazonada</span>"};
  function fold(t){return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  function cname(w){return w[L]||w[0];}
  function ctry(w){return w[2+L]||w[2];}
  function dist(k){return k<2?"menos de 2 km (más o menos una milla)":Math.round(k/1.609344)<2?""+Math.round(k)+" km (más o menos una milla)":""+Math.round(k)+" km ("+Math.round(k/1.609344)+" millas)";}
  var inp=document.getElementById("ft-zip"),out=document.getElementById("ft-out");
  if(!inp||!out)return;
  var DATA=null,loading=false,pending=null;
  function load(){
    if(DATA||loading)return;loading=true;
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
    var o=['<svg class="ff-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+(fall?"Primera helada de otoño":"Última helada de primavera")+' (probabilidades en '+nm+')">'];
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
    var med="Mediana",ten="1 año de cada 10",room=(med.length/2+ten.length)*6.2+6;
    o.push(key(p50,med,esc(md(p50)),"middle",0));
    o.push(key(p10,ten,esc(md(p10)),fall?"start":"end",Math.abs(x(p10)-x(p50))<room?26:0));
    o.push("</svg>");
    return o.join("");
  }
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
      spring.push('<figure class="frostfig"><div class="ff-frame">'+bandSVG(s,false,nm)+'</div><ul class="ff-legend"><li><span class="ff-dot ff-risk"></span>helada la mayoría de los años</li><li><span class="ff-dot ff-gamble"></span>helada algunos años (la apuesta)</li><li><span class="ff-dot ff-safe"></span>helada rara (más o menos 1 año de cada 10)</li></ul></figure>');
    }
    if(stw&&!free)spring.push('<p>La estación meteorológica de '+esc(s[20])+', a '+dist(s[21])+', registró una helada en '+s[22]+' de sus '+s[23]+' inviernos registrados.'+(sd?' '+(two?(near?'Las fechas son las de la estación meteorológica de '+esc(s[24])+', a '+dist(s[26])+', sacadas de '+s[27]+' años de sus temperaturas mínimas diarias en los registros GHCN-Daily de NOAA. Su registro es el más largo.':'Las fechas son las de la estación meteorológica de '+esc(s[24])+', a '+dist(s[26])+', sacadas de '+s[27]+' años de sus temperaturas mínimas diarias en los registros GHCN-Daily de NOAA. Su registro es el más largo, así que la helada puede llegar más tarde de lo que muestran.'):'Estas fechas de helada son las propias de la estación meteorológica de '+esc(s[24])+', sacadas de '+s[27]+' años de sus temperaturas mínimas diarias en los registros GHCN-Daily de NOAA.'):'')+'</p>');
    if(!free)spring.push('<dl class="facts"><dt>Hiela así de tarde 1 año de cada 10</dt><dd>'+esc(md(s[5]))+'</dd><dt>1 año de cada 5</dt><dd>'+esc(md(s[6]))+'</dd><dt>3 años de cada 10</dt><dd>'+esc(md(s[7]))+'</dd><dt>2 años de cada 5</dt><dd>'+esc(md(s[8]))+'</dd><dt>La mitad de los años (la mediana)</dt><dd>'+esc(md(s[9]))+'</dd></dl>');
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
        autumn.push('<figure class="frostfig"><div class="ff-frame">'+bandSVG(s,true,nm)+'</div><ul class="ff-legend"><li><span class="ff-dot ff-safe"></span>helada rara tan temprano (más o menos 1 año de cada 10)</li><li><span class="ff-dot ff-gamble"></span>helada de otoño algunos años (la apuesta)</li><li><span class="ff-dot ff-risk"></span>ya hiela para estas fechas la mayoría de los años</li></ul></figure>');
        autumn.push('<dl class="facts"><dt>Hiela así de temprano 1 año de cada 10</dt><dd>'+esc(md(f10))+'</dd><dt>1 año de cada 5</dt><dd>'+esc(md(s[13]))+'</dd><dt>3 años de cada 10</dt><dd>'+esc(md(s[14]))+'</dd><dt>2 años de cada 5</dt><dd>'+esc(md(s[15]))+'</dd><dt>La mitad de los años (la mediana)</dt><dd>'+esc(md(f50))+'</dd>'+(s[11]?'<dt>Temporada de cultivo</dt><dd>unos '+s[11]+' días</dd>':'')+'</dl>');
      }else{
        autumn.push('<p class="answer">'+(adj&&!f10?'La primera helada de otoño en <strong>'+place+'</strong> llega alrededor del <strong>'+esc(md(f50))+'</strong> en la mitad de los años. Las fechas corregidas para este lugar solo conservan la mediana, así que es una sola fecha central, sin dispersión. Tómala como una respuesta menos firme que las probabilidades de primavera.':mw?'La primera helada de otoño en <strong>'+place+'</strong> llega alrededor del <strong>'+esc(md(f50))+'</strong> en la mitad de los años. La tabla del modelo meteorológico solo guarda aquí la mediana, así que es una sola fecha central, sin dispersión. Tómala como una respuesta menos firme que las probabilidades de primavera.':'La primera helada de otoño en <strong>'+place+'</strong> llega alrededor del <strong>'+esc(md(f50))+'</strong> en la mitad de los años. Esta estación solo registra la mediana, así que es una sola fecha central, sin dispersión. Tómala como una respuesta menos firme que las probabilidades de primavera.')+'</p>');
        if(s[11])autumn.push('<dl class="facts"><dt>Temporada de cultivo</dt><dd>unos '+s[11]+' días</dd></dl>');
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
    var ladder='<div class="nexttrail"><p class="ladder"><a class="ladder-cta" href="../../web/?lang=es#/answers?situation=now&amp;'+pq+'" data-next="now"><span>¿Qué puedo sembrar ahora?</span> &rsaquo;</a></p>'
      +'<p class="more"><a href="../../web/?lang=es#/answers?'+pq+'" data-next="when">¿Cuándo siembro?</a> &middot; <a class="ft-map" data-next="map">De dónde vienen las fechas</a></p></div>';
    var blocks=fallFirst?autumn.concat(spring):spring.concat(autumn),at=-1;
    for(var i=0;i<blocks.length;i++){if(blocks[i].indexOf('<p class="answer">')===0){at=i;break;}}
    if(at>=0)blocks.splice(at+1,0,ladder);
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
