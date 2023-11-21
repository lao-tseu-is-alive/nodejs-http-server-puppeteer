/*
 filename    : http_server.js
 version     : 0.1.0
 date        : 2023-11-21
 author      : lao.tseu.is.alive@gmail.com
 description : a simple Node.js http server (not using express) to illustrate how to use puppeteer to print a pdf of a dynamic url  of OpenStreetMap
 */
const http = require('http');
const puppeteer = require('puppeteer');
const url = require('url');
const process = require('process');
const PORT = process.env.PORT || 5555;
const HOSTNAME = process.env.HOSTNAME || 'localhost';
const PROTOCOL = 'http'
const basePrintUrlRoute = "/print-map";
const nPixWidth = 1024;
const nPixHeight = 1024;
const getMapUrl = (z, lon, lat) => `https://www.openstreetmap.org/#map=${z}/${lon}/${lat}`;

const logIt = (msg, level) => {
		const now = new Date();
		switch (level) {
				case "ERROR":
						console.error(`time:"${now.toISOString()}", msg:"${msg}"`);
						break;
				case "WARNING":
						console.warn(`time:"${now.toISOString()}", msg:"${msg}"`);
						break;
				default:
						console.log(`time:"${now.toISOString()}", msg:"${msg}"`);
		}
}

const printPDF = async (url2Print) => {
		const browser = await puppeteer.launch({headless: "new"});
		const page = await browser.newPage();
		await page.setViewport({width: nPixWidth, height: nPixHeight});
		let pdf = null
		try {
				await page.goto(url2Print, {waitUntil: 'networkidle2'});
		} catch (e) {
				logIt(`Error loading page :${e.message}`, "ERROR");
		}
		try {
				pdf = await page.pdf({
						// path: pdfName,  // in case you prefer saving a file
						format: "A4",
						printBackground: true
				});
		} catch (e) {
				logIt(`Error generating pdf page :${e.message}`, "ERROR");
		}
		await browser.close();
		return pdf
}

const server = http.createServer(async (req, res) => {
		
		const remoteIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
		const queryParams = url.parse(req.url, true).query;
		
		
		// handler for GET http://localhost:5555/api
		// example of test in command line : curl -s "http://localhost:5555/print-map?zoom=14&lon=46.78&lat=6.66&dump=1" |jq
		if (req.url.indexOf(basePrintUrlRoute) > -1 && req.method === "GET") {
				logIt(` ip:"${remoteIp}", url:"${req.url}", method:"GET", query:"${JSON.stringify(queryParams)}"`);
				// how to check for mandatory parameter
				if (!("zoom" in queryParams)) {
						res.writeHead(500, {"Content-Type": "application/json"});
						res.end(JSON.stringify({message: "parameter zoom is missing"}));
				}
				let longitude = 46.52253;
				let latitude = 6.62530;
				let zoom = 18;
				let dumpValues = 0;
				try {
						longitude = parseFloat(`${queryParams.lon}`)
						latitude = parseFloat(`${queryParams.lat}`)
						zoom = parseInt(`${queryParams.zoom}`);
						dumpValues = parseInt(`${queryParams.dump}`);
						
				} catch (err) {
						res.writeHead(500, {"Content-Type": "application/json"});
						res.end(JSON.stringify({message: `error in parameters values,  ${err.message}`}));
				}
				if (dumpValues === 1) {
						res.writeHead(200, {"Content-Type": "application/json"});
						const params = {zoom, longitude, latitude, url: getMapUrl(zoom, longitude, latitude)}
						res.end(JSON.stringify(params));
				} else {
						const mapUrl = getMapUrl(zoom, longitude, latitude);
						logIt(`About to retrieve url : ${mapUrl}`);
						
						await (async () => {
								const pdf = await printPDF(mapUrl)
								if (pdf !== null) {
										res.setHeader('Content-Length', pdf.length);
										res.setHeader('Content-Type', 'application/pdf');
										res.end(pdf, 'binary')
								} else {
										res.writeHead(500, {"Content-Type": "application/json"});
										res.end(JSON.stringify({message: "error generating pdf"}));
								}
						})();
				}
		}
		// If client is trying a route that is not handled by us then 404 not found ...
		else {
				logIt(` ip:"${remoteIp}", url:"${req.url}", method:"${req.method}" status:404`);
				res.writeHead(404, {"Content-Type": "application/json"});
				res.end(JSON.stringify({message: `Route not found : ${JSON.stringify(req.url)}`}));
		}
})


server.on('error', (e) => {
		if (e.code === 'EADDRINUSE') {
				console.log(`ERROR trying to listen to ${HOSTNAME}:${PORT} !  Address is already in use,`);
		} else {
				console.error(`Unknown error trying to listen to ${HOSTNAME}:${PORT} ${e.message}\n`);
		}
		server.close()
		process.exit(1)
});

server.listen(PORT, HOSTNAME, () => {
		console.log(`http server listening on ${HOSTNAME}:${PORT}/${basePrintUrlRoute}`);
		console.log(`navigate to : ${PROTOCOL}://${HOSTNAME}:${PORT}/${basePrintUrlRoute}/?zoom=15&lon=46.78&lat=6.66`)
});


