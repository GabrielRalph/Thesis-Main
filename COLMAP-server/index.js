const { Client } = require('ssh2');
const SFTPClient = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');

const serverConfig = {
  host: '113.29.247.21', // Replace with Vast.ai instance IP
  port: 4188,
  username: 'root',
  privateKey: fs.readFileSync('/Users/gabrielralph/.ssh/id_rsa'), // Replace with your SSH key
  passphrase: "yby645"
};


const projectRootLocal = "../Test2";
const projectRootRemote = "/workspace/Test2";

const localImageFolder  = projectRootLocal + '/images'; // Folder containing images on your local machine
const remoteImageFolder = projectRootRemote + '/images'; // Remote destination on Vast.ai instance

const colmapScript = ("DATASET_PATH=" + projectRootRemote + "\n") + fs.readFileSync('./colmap_script.sh', 'utf8');


const matchers = [
    {
        update: (state, match) => {
            let name = match[1];
            if (!("Processing View" in state)) state["Processing View"] = {};
            if (!(name in state["Processing View"])) state["Processing View"][name] = 0;
            state["Processing View"][name]++;
        },
        regex:  /=+Processing view\s+\d+\s+\d+\s+for\s+(.*)\n/
    },
    {
        update: (state, match) => {
            let name = match[1];
            let features = match[2];
            if (!("Features" in state)) state["Features"] = {};
            if (!(name in state["Features"])) state["Features"][name] = features;
        },
        regex: "Feature Extraction" // TODO
    }
]

function parseColmapOutput(str) {

}

async function downloadResults() {
    const sftp = new SFTPClient();

    let dense_fused = projectRootRemote + "/database.db"
    let output = projectRootLocal + "/output" 
  
    try {
      await sftp.connect(serverConfig);
      console.log('📥 Downloading COLMAP results...');
  
      // Ensure local output folder exists
      if (!fs.existsSync(output)) {
        fs.mkdirSync(output, { recursive: true });
      }
  
    //   const files = await sftp.list(remoteOutputFolder);
    //   for (const file of files) {
        const name = "database.db"
        const remoteFilePath = dense_fused;
        const localFilePath = path.join(output, name);
        await sftp.get(remoteFilePath, localFilePath);
        console.log(`✅ Downloaded: ${name}`);
    //   }
  
      console.log('🎉 All results downloaded successfully!');
      await sftp.end();
    } catch (err) {
      console.error(`❌ Download Error: ${err.message}`);
    }
}

async function uploadImages(source, destination) {
  const sftp = new SFTPClient();

  try {
    await sftp.connect(serverConfig);
    console.log('📤 Uploading images to the server...');

    // Ensure remote directory exists
    await sftp.mkdir(destination, true);

    const localImages = fs.readdirSync(source);
    const remoteImages = new Set((await sftp.list(destination)).map(f => f.name));

    for (const file of localImages) {
        if (file !== ".DS_Store" && !remoteImages.has(file)) {
            const localFilePath = path.join(source, file);
            const remoteFilePath = `${destination}/${file}`;
            await sftp.fastPut(localFilePath, remoteFilePath, {
                step: (total_transferred, chunk, total) => {
                    let p = total_transferred / total;
                    let str = new Array(Math.round(p * 20)).fill('█').join("").padEnd(20, "-");
                    process.stdout.write(`\r ${file} |${str}| ${(Math.round(100*p) + "").padStart(3)}% `);
                }
            });
            process.stdout.write(` ✅\n`);
        }
    }

    console.log('🎉 All images uploaded successfully!');
    await sftp.end();
  } catch (err) {
    console.error(`❌ SFTP Error: ${err.message}`);
  }
}

// Function to process images with COLMAP
function runScript(script) {
    return new Promise((resolve, reject) => {
        
        const conn = new Client();
      
        conn.on('ready', () => {
          console.log('✅ SSH Connection Established');
      
          conn.exec(script, (err, stream) => {
            if (err) throw err;
      
            stream.on('close', (code, signal) => {
              console.log(`🚀 COLMAP finished with exit code ${code}`);
              conn.end();
              resolve()
            });
      
            stream.stderr.on('data', (data) => {
              console.log(`📜: ${data.toString()}`);
            });
          });
        }).connect(serverConfig);
    })
}

async function delay(ms){
    return new Promise((r) => {
        setTimeout(r, ms)
    })
}



async function main(){
    runScript(fs.readFileSync('./build_colmap.sh', 'utf8'))
    // await uploadImages(localImageFolder, remoteImageFolder);
    // console.log(colmapScript);
    
    // await runColmap();
    // await downloadResults();
}

main();



