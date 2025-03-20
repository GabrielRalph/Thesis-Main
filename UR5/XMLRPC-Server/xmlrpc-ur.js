

const express = require('express')
const app = express()
const { XMLParser, XMLBuilder } = require("fast-xml-parser");

const PARSERS = {
    value: (obj) => {
        let type = Object.keys(obj)[0];
        return PARSERS[type](obj[type])
    },
    double: (obj) => parseFloat(obj),
    boolean: (obj) => obj != 0,
    i4: (obj) => parseInt(obj),
    string: (obj) => obj,
    struct: (obj) => {
        let members = obj.member;
        let res = {};
        for (let m of members) {
            res[m.name] = PARSERS.value(m.value);
        }
        return res;
    },
    array: (obj) => obj.data.value.map(v => PARSERS.value(v))
}
function toXMLValue(value) {
    let xml = "";
    switch (typeof value) {
        case "boolean": 
            xml = `<boolean>${value ? 1 : 0}</boolean>`;
            break;

        case "number":
            let r = Math.round(value)
            if (r == value) {
                xml = `<i4>${r}</i4>`;
            } else {
                xml = `<double>${value}</double>`;
            }
            break;

        case "string":
            xml = `<string>${value}</string>`;
            break;

        case "object":
            if (value == null) {
                xml = "<nil/>"
            } else if (Array.isArray(value)) {
                xml = `<array><data>\n${value.map(toXMLValue).join("\n")}\n</data></array>`
            } else {
                let members = Object.keys(value).map(key => `<member>\n<name>${key}</name>\n${toXMLValue(value[key])}\n</member>`);
                xml = `<struct>\n${members.join("\n")}\n</struct>`
            }
            break;
    }

    return `<value>${xml}</value>`;
}
function toResponse(...params) {
    return `<?xml version="1.0"?>
            <methodResponse>
                <params>
                    ${params.map(p => `<param>${toXMLValue(p)}</param>`).join("\n")}
                </params>
            </methodResponse>`
}
function toFaultResponse(fault) {
    return `<?xml version="1.0"?>
            <methodResponse>
                <fault>
                    ${toXMLValue(fault)}
                </fault>
            </methodResponse>`
}
function parseMethodCall(text) {
    let parser = new XMLParser();
    let {methodCall: {methodName, params: {param}}} = parser.parse(text);

    let params = [];
    if (Array.isArray(param)) {
        params = param.map(PARSERS.value);
    } else {
        params = [PARSERS.value(param)];
    }

    return [methodName, params]
    
}

class XMLError extends Error {
    constructor(message, faultCode) {
        super(message);
        this.faultCode = faultCode;
    }
}

class XMLRPCServer {
    constructor() {
        this.app = express();
        this.app.use(express.text({type: "text/xml"}))
        this.app.post('/', (req, res) => {
            let [method, params] = parseMethodCall(req.body);
            let xml = "";

            console.log(`Received RPC request for method "${method}"`)

            if (method in this && this[method] instanceof Function) {
                try {
                    xml = toResponse(this[method](...params));
                } catch (e) {
                    if (e instanceof XMLError) {
                        xml = toFaultResponse({faultCode: e.faultCode, faultString: e.message})
                    } else {
                        console.log(e);
                        xml = toFaultResponse({faultCode: 1000, faultString: e + ""})
                    }
                }
            } else {
                xml = toFaultResponse({faultCode: 4041, faultString: `No method with name '${method}'.`})
            }

            console.log("Response: ", xml);
            
            res.set("Content-Type", "text/xml");
            res.send(xml);
        })
    }

    listen(...args) {
        this.app.listen(...args)
    }
}

module.exports = {XMLError, XMLRPCServer}
