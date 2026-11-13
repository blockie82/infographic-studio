/* Sample projects for each template. All data here is invented for demonstration. */
window.InfographicSamples = (function () {
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  function barRace() {
    var r = rng(42);
    var names = ['Nimbus', 'Arcadia', 'Lumen', 'Cobalt', 'Vireo', 'Halcyon', 'Quill', 'Orbit', 'Saffron', 'Tundra', 'Marlow', 'Pixel Park', 'Zephyr', 'Juniper'];
    var years = []; for (var y = 2013; y <= 2026; y++) years.push(String(y));
    var data = [['Name'].concat(years)];
    names.forEach(function (n, i) {
      var v = 5 + r() * 40, growth = 0.02 + r() * 0.35, row = [n];
      if (i === 3) growth = 0.26; // a late riser
      if (i === 0) growth = 0.08;
      years.forEach(function (_, k) {
        var boost = (i === 3 && k > 6) ? 1.06 : 1;
        v = v * (1 + growth * (0.6 + r() * 0.8)) * boost;
        if (i === 1 && k > 8) v *= 0.9; // a decliner
        row.push(String(Math.round(v * 10) / 10));
      });
      data.push(row);
    });
    return {
      name: 'Streaming subscribers race',
      template: 'barRace',
      size: { w: 1920, h: 1080 },
      data: data,
      settings: {
        title: 'Streaming subscribers by platform',
        subtitle: 'Millions of paying subscribers at year end (invented sample data)',
        source: 'Source: Infographic Studio sample data',
        suffix: 'M', decimals: 1, compact: false, duration: 16, topN: 10
      }
    };
  }

  function line() {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var a = [42, 45, 51, 58, 66, 79, 95, 101, 88, 74, 60, 55];
    var b = [30, 33, 34, 40, 47, 52, 60, 63, 59, 57, 61, 70];
    var c = [12, 14, 18, 25, 31, 38, 41, 44, 47, 52, 58, 66];
    var data = [['Month', 'Coastal trail', 'City museum', 'Night market']];
    months.forEach(function (m, i) { data.push([m, String(a[i] * 1000), String(b[i] * 1000), String(c[i] * 1000)]); });
    return {
      name: 'Visitors line chart', template: 'line', size: { w: 1920, h: 1080 }, data: data,
      settings: { title: 'Monthly visitors to three attractions', subtitle: 'Invented sample data', source: 'Source: Infographic Studio sample data', duration: 7, compact: true }
    };
  }

  function columns() {
    return {
      name: 'Survey column chart', template: 'columns', size: { w: 1920, h: 1080 },
      data: [
        ['Activity', '2025', '2026'],
        ['Walking', '61', '64'],
        ['Cycling', '28', '33'],
        ['Swimming', '22', '21'],
        ['Running', '19', '24'],
        ['Yoga', '14', '18'],
        ['Climbing', '6', '9']
      ],
      settings: { title: 'How people stay active', subtitle: 'Share of respondents doing each activity weekly (invented sample data)', suffix: '%', compact: false, duration: 4, source: 'Source: Infographic Studio sample data' }
    };
  }

  function donut() {
    return {
      name: 'Energy mix donut', template: 'donut', size: { w: 1920, h: 1080 },
      data: [['Source', 'Share'], ['Wind', '31'], ['Gas', '27'], ['Nuclear', '14'], ['Solar', '9'], ['Biomass', '8'], ['Hydro', '4'], ['Other', '7']],
      settings: { title: 'Where our electricity came from', subtitle: 'Share of generation (invented sample data)', suffix: '%', compact: false, duration: 3, centerLabel: 'of generation', showCenter: false, source: 'Source: Infographic Studio sample data' }
    };
  }

  function pictogram() {
    return {
      name: 'Survey icon chart', template: 'pictogram', size: { w: 1920, h: 1080 },
      data: [['Response', 'People', 'Icon'], ['Strongly agree', '34', 'person'], ['Agree', '28', 'person'], ['Neutral', '18', 'person'], ['Disagree', '12', 'person'], ['Strongly disagree', '8', 'person']],
      settings: { title: 'Out of every 100 people we asked…', subtitle: '“I feel my local park is well looked after” (invented sample data)', source: 'Source: Infographic Studio sample data', duration: 4, palette: 'ocean', compact: false }
    };
  }

  function counters() {
    return {
      name: 'Year in numbers', template: 'counters', size: { w: 1920, h: 1080 },
      data: [
        ['Label', 'Value', 'Icon', 'Caption'],
        ['Volunteers', '1240', 'person', 'gave their time this year'],
        ['Trees planted', '18500', 'tree', 'across 42 community sites'],
        ['Homes supported', '342', 'house', 'with energy-saving upgrades'],
        ['Litres of water saved', '2400000', 'drop', 'through leak repairs'],
        ['Average rating', '4.8', 'star', 'from 3,100 reviews'],
        ['Awards won', '6', 'trophy', 'including Charity of the Year']
      ],
      settings: { title: 'Our year in numbers', subtitle: 'Invented sample data', source: 'Source: Infographic Studio sample data', duration: 4, compact: false }
    };
  }

  function wordCloud() {
    var words = [['Flexibility', 96], ['Team', 88], ['Learning', 74], ['Recognition', 66], ['Trust', 63], ['Balance', 58], ['Purpose', 55], ['Pay', 52],
      ['Autonomy', 47], ['Wellbeing', 45], ['Growth', 43], ['Respect', 41], ['Feedback', 38], ['Support', 36], ['Friendly', 33], ['Remote', 31],
      ['Mentoring', 29], ['Inclusion', 28], ['Clarity', 26], ['Fun', 25], ['Hybrid', 24], ['Training', 23], ['Impact', 22], ['Creativity', 21],
      ['Stability', 20], ['Benefits', 19], ['Leadership', 18], ['Openness', 17], ['Kindness', 16], ['Variety', 15], ['Challenge', 14], ['Pensions', 13],
      ['Coffee', 12], ['Community', 12], ['Honesty', 11], ['Progress', 11], ['Calm', 10], ['Curiosity', 10], ['Celebrations', 9], ['Ownership', 9],
      ['Tools', 8], ['Commute', 8], ['Breaks', 7], ['Diversity', 7], ['Office', 6], ['Lunches', 6], ['Volunteering', 5], ['Sunshine', 5]];
    return {
      name: 'Staff survey word cloud', template: 'wordCloud', size: { w: 1920, h: 1080 },
      data: [['Word', 'Mentions']].concat(words.map(function (w) { return [w[0], String(w[1])]; })),
      settings: { title: 'What our people value most at work', subtitle: 'Words used in staff survey answers (invented sample data)', source: 'Source: Infographic Studio sample data', duration: 4 }
    };
  }

  function scatter() {
    var r = rng(7);
    var regions = ['North', 'South', 'East', 'West'];
    var names = ['Aurelia', 'Brakmar', 'Caldera', 'Dunmore', 'Elvaria', 'Fenwick', 'Galdor', 'Halvard', 'Istra', 'Jorvik', 'Kestrel', 'Lunara', 'Merrow', 'Norvale', 'Ostra', 'Pellam', 'Quarry Isles', 'Rosmund'];
    var data = [['Country', 'Year', 'Income per person', 'Life expectancy', 'Population', 'Region']];
    names.forEach(function (n, i) {
      var inc = 450 * Math.pow(10, (i / names.length) * 1.7 + r() * 0.25), life = 49 + (Math.log10(inc) - 2.6) * 10 + r() * 5, pop = 2e6 + Math.pow(r(), 3) * 3e8;
      var g = 0.008 + r() * 0.04, reg = regions[i % 4];
      for (var y = 2000; y <= 2025; y += 5) {
        data.push([n, String(y), String(Math.round(inc)), (Math.min(86, life)).toFixed(1), String(Math.round(pop)), reg]);
        inc *= Math.pow(1 + g, 5); life += 0.9 + r() * 1.8; pop *= 1 + r() * 0.12;
      }
    });
    return {
      name: 'Wealth and health bubbles', template: 'scatter', size: { w: 1920, h: 1080 }, data: data,
      settings: { title: 'Richer and longer lives', subtitle: 'Income per person vs life expectancy, bubble size = population (invented countries and data)', source: 'Source: Infographic Studio sample data',
        logX: true, xTitle: 'Income per person (£, log scale)', yTitle: 'Life expectancy (years)', duration: 10, compact: true, xFormat: false }
    };
  }

  function parliament() {
    return {
      name: 'Election result', template: 'parliament', size: { w: 1920, h: 1080 },
      data: [['Party', 'Seats', 'Colour'], ['Harbour Party', '271', ''], ['Unity', '198', ''], ['Forward', '74', ''], ['Civic Greens', '41', ''], ['Rural League', '33', ''], ['Independents', '33', '#9ca3af']],
      settings: { title: 'Seats won in the general election', subtitle: '650 seats (invented parties and results)', source: 'Source: Infographic Studio sample data', duration: 4 }
    };
  }

  function treemap() {
    return {
      name: 'Household budget treemap', template: 'treemap', size: { w: 1920, h: 1080 },
      data: [
        ['Item', 'Monthly spend', 'Category'],
        ['Rent', '950', 'Housing'], ['Energy', '165', 'Housing'], ['Council tax', '140', 'Housing'], ['Water', '40', 'Housing'],
        ['Groceries', '380', 'Food'], ['Eating out', '120', 'Food'], ['Coffee', '35', 'Food'],
        ['Fuel', '140', 'Transport'], ['Train', '95', 'Transport'], ['Car insurance', '55', 'Transport'],
        ['Gym', '35', 'Leisure'], ['Streaming', '28', 'Leisure'], ['Hobbies', '60', 'Leisure'], ['Holidays fund', '150', 'Leisure'],
        ['Savings', '250', 'Savings'], ['Pension top-up', '100', 'Savings']
      ],
      settings: { title: 'Where a monthly budget goes', subtitle: 'Invented example household', source: 'Source: Infographic Studio sample data', prefix: '£', compact: false, duration: 3.5 }
    };
  }

  function mk(name, template, data, settings) {
    settings.source = settings.source || 'Source: Infographic Studio sample data';
    return { name: name, template: template, size: { w: 1920, h: 1080 }, data: data, settings: settings };
  }
  function area() {
    var d = [['Year', 'Solar', 'Wind', 'Hydro', 'Other renewables']];
    for (var y = 2010; y <= 2026; y++) { var t = y - 2010; d.push([String(y), String(Math.round(2 + t * t * 0.9)), String(Math.round(10 + t * 4.2)), String(Math.round(18 + Math.sin(t) * 2)), String(Math.round(5 + t * 0.8))]); }
    return mk('Renewables area chart', 'area', d, { title: 'Renewable generation keeps growing', subtitle: 'Terawatt hours by source (invented sample data)', suffix: ' TWh', compact: false, duration: 6 });
  }
  function waterfall() {
    return mk('Profit waterfall', 'waterfall', [['Step', 'Change'], ['Revenue', '820'], ['Cost of sales', '-310'], ['Gross profit', 'total'], ['Staff', '-190'], ['Marketing', '-75'], ['Rent', '-48'], ['Grants', '36'], ['Tax', '-52']],
      { title: 'From revenue to profit', subtitle: '£ thousands, financial year (invented sample data)', prefix: '£', suffix: 'k', compact: false, duration: 5, totalLabel: 'Net profit' });
  }
  function slope() {
    return mk('Recycling slope chart', 'slope', [['Council', '2016', '2026'], ['Northvale', '38', '61'], ['Eastmoor', '44', '52'], ['Riverside', '51', '49'], ['Hillcrest', '29', '47'], ['Westbridge', '57', '63'], ['Southport', '41', '36']],
      { title: 'Recycling rates, ten years on', subtitle: 'Share of household waste recycled (invented sample data)', suffix: '%', compact: false, duration: 4 });
  }
  function radar() {
    return mk('Phone comparison radar', 'radar', [['Measure', 'Model A', 'Model B'], ['Battery', '82', '64'], ['Camera', '70', '91'], ['Screen', '76', '85'], ['Speed', '68', '88'], ['Value', '90', '55'], ['Durability', '74', '62']],
      { title: 'How two phones compare', subtitle: 'Review scores out of 100 (invented sample data)', compact: false, duration: 4, radarMax: 100 });
  }
  function survey() {
    return mk('Staff survey results', 'survey', [['Statement', 'Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
      ['I feel valued at work', '6', '12', '20', '41', '21'], ['I have the tools I need', '4', '9', '17', '46', '24'], ['My workload is manageable', '14', '26', '22', '28', '10'],
      ['I would recommend working here', '5', '8', '19', '38', '30'], ['Communication from leaders is clear', '11', '21', '27', '30', '11']],
      { title: 'How staff feel about work', subtitle: 'Share of 1,200 responses (invented sample data)', duration: 4 });
  }
  function table() {
    return mk('League table', 'table', [['Team', 'Played', 'Won', 'Points', 'Goal difference'], ['Harbour City', '30', '22', '71', '41'], ['Northgate', '30', '20', '66', '33'], ['Riverside United', '30', '18', '61', '22'],
      ['Ashford Rovers', '30', '15', '52', '9'], ['Kingsmead', '30', '13', '47', '3'], ['Westvale', '30', '11', '40', '-6'], ['Millbrook', '30', '9', '33', '-15'], ['Port Elm', '30', '6', '24', '-28']],
      { title: 'League table', subtitle: 'After 30 games (invented teams and results)', compact: false, duration: 4 });
  }
  function marimekko() {
    return mk('Market share marimekko', 'marimekko', [['Region', 'Brand A', 'Brand B', 'Brand C', 'Others'], ['North', '420', '310', '150', '120'], ['South', '260', '340', '210', '90'], ['East', '180', '120', '160', '140'], ['West', '90', '150', '60', '100']],
      { title: 'Who leads in each region', subtitle: 'Width = region size, height = brand share (invented sample data)', compact: false, duration: 4 });
  }
  function sunburst() {
    return mk('Spending sunburst', 'sunburst', [['Department', 'Service', 'Spend'], ['Health', 'Hospitals', '92'], ['Health', 'GPs', '34'], ['Health', 'Public health', '12'], ['Education', 'Schools', '61'], ['Education', 'Universities', '18'], ['Education', 'Early years', '9'],
      ['Transport', 'Rail', '21'], ['Transport', 'Roads', '15'], ['Transport', 'Buses', '6'], ['Housing', 'Social housing', '14'], ['Housing', 'Support', '8'], ['Environment', 'Waste', '7'], ['Environment', 'Parks', '4']],
      { title: 'Where public money goes', subtitle: '£ billions (invented sample data)', prefix: '£', suffix: 'bn', compact: false, duration: 4 });
  }
  function packedBubbles() {
    var d = [['Language', 'Speakers', 'Family'], ['Mandarin', '1100', 'Sino-Tibetan'], ['Cantonese', '85', 'Sino-Tibetan'], ['English', '1450', 'Indo-European'], ['Hindi', '610', 'Indo-European'], ['Spanish', '560', 'Indo-European'],
      ['French', '310', 'Indo-European'], ['Bengali', '270', 'Indo-European'], ['Portuguese', '260', 'Indo-European'], ['Russian', '255', 'Indo-European'], ['Urdu', '230', 'Indo-European'], ['German', '135', 'Indo-European'],
      ['Arabic', '370', 'Afro-Asiatic'], ['Hausa', '80', 'Afro-Asiatic'], ['Amharic', '57', 'Afro-Asiatic'], ['Japanese', '125', 'Japonic'], ['Swahili', '200', 'Niger-Congo'], ['Yoruba', '45', 'Niger-Congo'],
      ['Indonesian', '200', 'Austronesian'], ['Tagalog', '83', 'Austronesian'], ['Turkish', '90', 'Turkic'], ['Korean', '82', 'Koreanic'], ['Tamil', '86', 'Dravidian'], ['Telugu', '96', 'Dravidian']];
    return mk('Languages bubble pack', 'packedBubbles', d, { title: 'Most spoken languages', subtitle: 'Total speakers in millions, grouped by language family (rough figures for demonstration)', suffix: 'm', compact: false, duration: 4 });
  }
  function gauge() {
    return mk('Targets gauges', 'gauge', [['Measure', 'Value', 'Min', 'Max', 'Target'], ['Customer satisfaction', '86', '0', '100', '90'], ['On-time delivery', '93.5', '0', '100', '95'], ['Budget used', '71', '0', '100', ''], ['Staff retention', '64', '0', '100', '80']],
      { title: 'Progress against targets', subtitle: 'Year to date (invented sample data)', suffix: '%', compact: false, duration: 3.5 });
  }
  function calendar() {
    var r = rng(11), d = [['Date', 'Steps']];
    for (var t = Date.UTC(2026, 0, 1); t <= Date.UTC(2026, 10, 13); t += 864e5) {
      var dt = new Date(t), wk = dt.getUTCDay(), base = (wk === 0 || wk === 6) ? 9000 : 6500, season = 1500 * Math.sin((dt.getUTCMonth() - 2) / 12 * Math.PI * 2);
      d.push([dt.toISOString().slice(0, 10), String(Math.max(800, Math.round(base + season + (r() - 0.5) * 7000)))]);
    }
    return mk('Steps calendar', 'calendar', d, { title: 'A year of daily steps', subtitle: 'Invented sample data', compact: false, duration: 6 });
  }
  function sankey() {
    return mk('Budget sankey', 'sankey', [['Source', 'Target', 'Value'], ['Salary', 'Household budget', '2900'], ['Side business', 'Household budget', '600'], ['Household budget', 'Housing', '1250'], ['Household budget', 'Food', '520'],
      ['Household budget', 'Transport', '290'], ['Household budget', 'Savings', '650'], ['Household budget', 'Leisure', '480'], ['Household budget', 'Bills', '310'], ['Housing', 'Rent', '1000'], ['Housing', 'Council tax', '150'], ['Housing', 'Insurance', '100'],
      ['Savings', 'Pension', '250'], ['Savings', 'Rainy day fund', '400']],
      { title: 'Where the monthly income goes', subtitle: 'Invented example household (£)', prefix: '£', compact: false, duration: 5 });
  }
  function chord() {
    return mk('Migration chord', 'chord', [['From', 'To', 'People'], ['North', 'South', '420'], ['South', 'North', '260'], ['North', 'East', '180'], ['East', 'North', '210'], ['East', 'West', '330'], ['West', 'East', '150'],
      ['West', 'South', '240'], ['South', 'West', '190'], ['North', 'West', '120'], ['City', 'North', '310'], ['City', 'South', '280'], ['East', 'City', '260'], ['West', 'City', '220']],
      { title: 'Moves between regions', subtitle: 'Thousands of people, last 10 years (invented sample data)', compact: false, duration: 5 });
  }
  function arc() {
    return mk('Co-authors arc diagram', 'arc', [['From', 'To', 'Papers'], ['Ada', 'Ben', '6'], ['Ada', 'Chen', '3'], ['Ben', 'Dina', '4'], ['Chen', 'Dina', '2'], ['Dina', 'Eli', '7'], ['Eli', 'Fay', '3'], ['Ada', 'Fay', '2'],
      ['Gus', 'Hana', '5'], ['Fay', 'Gus', '2'], ['Ben', 'Hana', '1'], ['Iris', 'Ada', '4'], ['Iris', 'Eli', '2'], ['Hana', 'Jon', '3'], ['Jon', 'Chen', '1']],
      { title: 'Who writes with whom', subtitle: 'Joint papers between researchers (invented sample data)', duration: 5 });
  }
  function network() {
    var groups = [['Ava', 'Ben', 'Cara', 'Dev', 'Eve', 'Finn'], ['Gia', 'Hal', 'Ivy', 'Jay', 'Kit'], ['Leo', 'Mia', 'Ned', 'Ola', 'Pip', 'Quin'], ['Rae', 'Sol', 'Tia', 'Uma']];
    var r = rng(5), d = [['From', 'To', 'Messages']];
    groups.forEach(function (g) { for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) if (r() < 0.6) d.push([g[i], g[j], String(1 + Math.round(r() * 9))]); });
    d.push(['Cara', 'Hal', '3'], ['Finn', 'Leo', '2'], ['Kit', 'Ned', '4'], ['Quin', 'Rae', '2'], ['Ava', 'Sol', '1'], ['Jay', 'Uma', '2']);
    return mk('Team network', 'network', d, { title: 'How teams talk to each other', subtitle: 'Messages between colleagues in one week (invented sample data)', duration: 6 });
  }
  function timeline() {
    return mk('Project timeline', 'timeline', [['Date', 'Event', 'Detail', 'Icon'], ['2019', 'Idea', 'Founded in a spare room', 'leaf'], ['2020', 'First grant', 'Funding for a pilot in two towns', 'pound'], ['2021', 'Pilot launch', '500 homes take part', 'house'],
      ['2022', 'National award', 'Recognised for community impact', 'trophy'], ['2024', 'Going digital', 'App launched for volunteers', 'phone'], ['2026', '10,000 homes', 'Now in 40 towns', 'star']],
      { title: 'Our story so far', subtitle: 'Invented sample timeline', duration: 6 });
  }
  function gantt() {
    return mk('Project plan gantt', 'gantt', [['Task', 'Start', 'End', 'Phase'], ['Research', '2026-01-05', '2026-02-13', 'Discovery'], ['User interviews', '2026-01-19', '2026-02-27', 'Discovery'], ['Design', '2026-02-16', '2026-04-10', 'Build'],
      ['Build', '2026-03-16', '2026-06-26', 'Build'], ['Testing', '2026-06-01', '2026-07-24', 'Launch'], ['Training', '2026-07-06', '2026-08-07', 'Launch'], ['Go live', '2026-08-10', '2026-08-14', 'Launch']],
      { title: 'Project plan 2026', subtitle: 'Invented sample plan', duration: 5, todayLine: '2026-05-01' });
  }
  function choropleth() {
    var d = [['Country', '2000', '2010', '2020', '2025']];
    var c = [['United Kingdom', 3, 10, 43, 52], ['France', 2, 14, 25, 33], ['Germany', 6, 17, 45, 54], ['Spain', 17, 33, 44, 57], ['Italy', 19, 25, 42, 47], ['Norway', 99, 96, 98, 98], ['Sweden', 55, 56, 68, 72],
      ['United States of America', 9, 10, 20, 25], ['Canada', 61, 62, 68, 67], ['Brazil', 90, 85, 84, 89], ['Mexico', 18, 17, 23, 22], ['Argentina', 31, 27, 25, 34], ['China', 17, 19, 29, 36],
      ['India', 14, 17, 20, 23], ['Australia', 8, 9, 27, 39], ['Japan', 10, 10, 21, 25], ['South Africa', 1, 2, 6, 13], ['Egypt', 18, 10, 11, 12], ['Kenya', 60, 69, 90, 91], ['Russia', 19, 17, 20, 19],
      ['Turkey', 25, 26, 42, 43], ['Indonesia', 19, 13, 19, 21], ['Saudi Arabia', 0, 0, 0, 2], ['Poland', 2, 7, 18, 30], ['Chile', 50, 37, 47, 63], ['New Zealand', 71, 73, 83, 86], ['Nigeria', 34, 22, 21, 23]];
    c.forEach(function (x) { d.push([x[0], String(x[1]), String(x[2]), String(x[3]), String(x[4])]); });
    return mk('Renewable share map', 'choropleth', d, { title: 'Share of electricity from renewables', subtitle: 'Selected countries (invented figures for demonstration, not real statistics)', suffix: '%', compact: false, duration: 8 });
  }
  function pointMap() {
    return mk('Offices point map', 'pointMap', [['Office', 'Latitude', 'Longitude', 'Staff', 'Region'], ['London', '51.51', '-0.13', '1200', 'Europe'], ['Edinburgh', '55.95', '-3.19', '240', 'Europe'], ['Berlin', '52.52', '13.40', '380', 'Europe'],
      ['Madrid', '40.42', '-3.70', '210', 'Europe'], ['New York', '40.71', '-74.01', '900', 'Americas'], ['Toronto', '43.65', '-79.38', '260', 'Americas'], ['São Paulo', '-23.55', '-46.63', '330', 'Americas'],
      ['Mexico City', '19.43', '-99.13', '150', 'Americas'], ['Lagos', '6.52', '3.38', '190', 'Africa'], ['Nairobi', '-1.29', '36.82', '170', 'Africa'], ['Cape Town', '-33.92', '18.42', '120', 'Africa'],
      ['Dubai', '25.20', '55.27', '230', 'Asia-Pacific'], ['Mumbai', '19.08', '72.88', '640', 'Asia-Pacific'], ['Singapore', '1.35', '103.82', '410', 'Asia-Pacific'], ['Tokyo', '35.68', '139.69', '520', 'Asia-Pacific'], ['Sydney', '-33.87', '151.21', '300', 'Asia-Pacific']],
      { title: 'Where our people work', subtitle: 'Staff by office (invented company)', compact: false, duration: 4 });
  }

  function cards() {
    return mk('Energy tips cards', 'cards', [['Title', 'Text', 'Tag', 'Icon'],
      ['Turn the heating down a little', 'A slightly lower thermostat setting is one of the simplest ways to use less energy over winter.', 'Heating', 'sun'],
      ['Switch off standby', 'TVs, games consoles and chargers left on standby quietly use power all day. Switch them off at the wall.', 'Electricity', 'bolt'],
      ['Shorter showers', 'Cutting a few minutes from each shower saves hot water and the energy used to heat it.', 'Water', 'drop'],
      ['Wash at 30°C', 'Most everyday laundry comes out clean at lower temperatures, and fuller loads mean fewer washes.', 'Laundry', 'check'],
      ['Draught-proof doors', 'Brush strips and keyhole covers keep warm air in and are cheap to fit yourself.', 'Home', 'house'],
      ['Plant for shade', 'Trees and climbers can shade windows in summer, keeping rooms cooler without a fan.', 'Garden', 'tree']],
      { title: 'Six easy ways to save energy at home', subtitle: 'General tips (sample content)', duration: 4 });
  }
  function quoteCards() {
    return mk('Volunteer quotes carousel', 'quoteCards', [['Quote', 'Name', 'Role', 'Icon'],
      ['Volunteering on the river clean-up gave me a reason to get outside every week, and I have made friends for life.', 'Sam Okafor', 'Volunteer, Riverside project', 'leaf'],
      ['The app made it easy to find a shift that fitted round my kids. I never thought I would have time to help.', 'Priya Nair', 'Parent and weekend volunteer', 'phone'],
      ['Seeing the community garden full of families on a Saturday morning is the best part of my job.', 'Tom Hughes', 'Project coordinator', 'heart']],
      { title: 'In their own words', subtitle: 'Invented example quotes for this template', duration: 12, source: 'Sample content: names and quotes are invented' });
  }
  function rankCards() {
    return mk('Fundraising leaderboard', 'rankCards', [['Team', 'Raised', 'Change', 'Icon', 'Caption'],
      ['Harbour Runners', '18450', '+12%', '🏃', '42 members'], ['Northgate Bakers', '15210', '+31%', '🧁', 'Cake sales every Friday'], ['Westvale Cyclists', '12980', '-4%', '🚲', 'Coast-to-coast ride'],
      ['Riverside Choir', '9640', '+8%', '🎵', 'Winter concert'], ['Millbrook Book Club', '7325', '+19%', '📚', 'Readathon'], ['Port Elm Swimmers', '5890', '-2%', '🏊', 'Sea swim challenge']],
      { title: 'Fundraising leaderboard', subtitle: 'Total raised this year (invented teams and figures)', prefix: '£', compact: false, duration: 5 });
  }
  function stepCards() {
    return mk('How to apply steps', 'stepCards', [['Step', 'Description', 'Icon'],
      ['Check you are eligible', 'Read the short guide to see who can apply and what the grant covers.', 'check'],
      ['Gather your details', 'You will need your organisation details, a budget and a short project plan.', 'book'],
      ['Apply online', 'Fill in the form in one go or save it and come back later.', 'laptop'],
      ['Hear back in 6 weeks', 'We will email you with a decision and next steps.', 'chat']],
      { title: 'How to apply for a community grant', subtitle: 'Example process (sample content)', duration: 5 });
  }

  return { barRace: barRace, line: line, columns: columns, donut: donut, pictogram: pictogram, counters: counters, wordCloud: wordCloud, scatter: scatter, parliament: parliament, treemap: treemap,
    area: area, waterfall: waterfall, slope: slope, radar: radar, survey: survey, table: table, marimekko: marimekko, sunburst: sunburst, packedBubbles: packedBubbles, gauge: gauge, calendar: calendar,
    sankey: sankey, chord: chord, arc: arc, network: network, timeline: timeline, gantt: gantt, choropleth: choropleth, pointMap: pointMap,
    cards: cards, quoteCards: quoteCards, rankCards: rankCards, stepCards: stepCards };
})();
