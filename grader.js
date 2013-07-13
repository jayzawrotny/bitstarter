#!/usr/bin/env node
/*
Automatically grade files for the presence of specified HTML tags/attributes.
Uses commander.js and cheerio. Teaches command line application development
and basic DOM parsing.

References:

 + cheerio
   - https://github.com/MatthewMueller/cheerio
   - http://encosia.com/cheerio-faster-windows-friendly-alternative-jsdom/
   - http://maxogden.com/scraping-with-node.html

 + commander.js
   - https://github.com/visionmedia/commander.js
   - http://tjholowaychuk.com/post/9103188408/commander-js-nodejs-command-line-interfaces-made-easy

 + JSON
   - http://en.wikipedia.org/wiki/JSON
   - https://developer.mozilla.org/en-US/docs/JSON
   - https://developer.mozilla.org/en-US/docs/JSON#JSON_in_Firefox_2
*/

var fs = require('fs');
var program = require('commander');
var cheerio = require('cheerio');
var rest = require('restler');

var HTMLFILE_DEFAULT = false;
var URL_DEFAULT = false;
var FORMAT_DEFAULT = "JSON";
var CHECKSFILE_DEFAULT = "checks.json";

var outputFormats = {};

var assertFileExists = function(infile) {
    var instr = infile.toString();
    if(!fs.existsSync(instr)) {
        console.log("%s does not exist. Exiting.", instr);
        process.exit(1); // http://nodejs.org/api/process.html#process_process_exit_code
    }
    return instr;
};

var assertURLExists = function(inurl) {
    var instr = inurl.toString();
    if(instr) {
        return instr;
    } else {
        console.log("Invalid URL specified.");
        process.exit(1);
    }
};

var assertFormatExists = function(format) {
    var outputFormat = format.toUpperCase();
    var output = outputFormats[outputFormat];
    var formats = Object.keys(outputFormats).join(', ');

    if ( typeof output === 'function' ) {
        return outputFormat;
    } else {
        console.error("Invalid output format. Accepted values are: " + formats); 
        process.exit(1);
    }
}

var loadChecks = function(checksfile) {
    return JSON.parse(fs.readFileSync(checksfile));
};

var processHTML = function(html, checks) {
    var $ = cheerio.load(html);
    var out = {};

    for(var ii in checks) {
        var present = $(checks[ii]).length > 0;
        out[checks[ii]] = present;
    }

    return out;
};

var outputJSON = function(output) {
    output = JSON.stringify(output, null, 4);
    console.log(output);
    return output;
};

outputFormats['JSON'] = outputJSON;

var buildCheckCallback = function(source, outputFormat) {
    return function(html, checksfile) {
        var checkResults = processHTML(html, checksfile);
        console.log('Results from: ' + source ); 
        outputFormat(checkResults);
    };
};

var checkHTML = function(sourcesToCheck, checksfile, output) {
    var checks = loadChecks(checksfile).sort();
    var outputFormatter = outputFormats[output] || FORMAT_DEFAULT;
    var hasRan = false;

    for (var key in sourcesToCheck) {
        var source = sourcesToCheck[key];
        if ( ! source.input ) {
            continue;
        }

        source.process(source.input, checks, buildCheckCallback(source.input, outputFormatter));
        hasRan = true;
    }

    if (! hasRan) {
        console.error('No valid input given.');
        process.exit(1);
    }
};
var checkFile = function(htmlfile, checksfile, callback) {
    var html = fs.readFileSync(htmlfile);
    callback(html, checksfile);
};

var checkURL = function(url, checksfile, callback) {
    rest.get(url).on('complete', function(result) {
        if (result instanceof Error) {
            console.error('Error: ' + result.message);
            process.exit(1);
        } else {
            callback(result, checksfile);
        }
    });
}

var clone = function(fn) {
    // Workaround for commander.js issue.
    // http://stackoverflow.com/a/6772648
    return fn.bind({});
};

if(require.main == module) {
    program
        .option('-c, --checks <check_file>', 'Path to checks.json', clone(assertFileExists), CHECKSFILE_DEFAULT)
        .option('-f, --file <html_file>', 'Path to index.html', clone(assertFileExists), HTMLFILE_DEFAULT)
        .option('-u, --url <url>', 'URL to html file.', clone(assertURLExists), URL_DEFAULT)

        .option('-o, --output <output>', 'Output Format', clone(assertFormatExists), FORMAT_DEFAULT)

        .parse(process.argv);

        // Based on what input we have, use the proper one to check.
        checkHTML([ 
            { input: program.file, process: checkFile },
            { input: program.url, process: checkURL }
            ], program.checks, program.output);
} else {
    exports.checkHtmlFile = checkHtmlFile;
}
