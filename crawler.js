const fetch = require('node-fetch');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const DOMParser = require('xmldom').DOMParser; 

async function extractProductUrls(url, domain) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const productLinks = Array.from(doc.querySelectorAll('.theme-preview a')) 
      .filter(a => a.hasAttribute('href')) 
      .map(a => a.getAttribute('href')); 

    return productLinks.map(link => domain + link); 
  } catch (error) {
    console.error(Error fetching ${url}:, error);
    try {
      console.log(`Retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); 
      const response = await fetch(url);
      const html = await response.text(); 
      const doc = new DOMParser().parseFromString(html, 'text/html'); 

      const productLinks = Array.from(doc.querySelectorAll('.theme-preview a')) 
        .filter(a => a.hasAttribute('href')) 
        .map(a => a.getAttribute('href')); 

      return productLinks.map(link => domain + link); 
    } catch (error) {
      console.error("Error fetching " + url + ":", error); 
      return []; 
    }
  }
}

async function crawlWebsite(domain, startingUrl, db) {
  const visitedUrls = new Set();
  const queue = [startingUrl];

  while (queue.length > 0) {
    const currentUrl = queue.shift();
    if (visitedUrls.has(currentUrl)) continue;
    visitedUrls.add(currentUrl);

    try {
      const productUrls = await extractProductUrls(domain + currentUrl, domain);

      for (const productUrl of productUrls) {
        await db.run('INSERT OR IGNORE INTO urls (url, domain) VALUES (?, ?)', productUrl, domain);
      }

    } catch (error) {
      console.error(Error crawling ${currentUrl}:, error);
    }
  }
}

async function main() {
  const domains = [
    'https://themeforest.net/search/ecommerce', 
  ];

  const db = await open({ filename: './crawler.db', driver: sqlite3.Database });

  await db.run('CREATE TABLE IF NOT EXISTS urls (url TEXT UNIQUE, domain TEXT)');

  for (const domain of domains) {
    await crawlWebsite(domain, '/', db);
  }

  const rows = await db.all('SELECT url FROM urls'); 
  const productUrls = rows.map(row => row.url); 

  console.log("Discovered Product URLs:");
  console.log(productUrls); 

  await db.close();
}

main();