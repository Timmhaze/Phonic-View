let source, fft, spectrum, volume, peakDetect, peak = false, specLength = 256, radius, energy, isDistorted = false, multiplier = 1; // Variables used for reading sound values
let width = window.innerWidth, height = window.innerHeight; // Shorthand variables for window width & height
let bNormalize = true, centerClip = false; // Used for reading notes
let noteArray = [], positiveArray = [], negativeArray = []; // Note Arrays
let cubeArray = [], peakSphereArray = [], towersArray = [], soundBarArray = []; // Graphic arrays
let moodArray = ["white", "blue", "darkBlue", "red", "darkRed"]; // Colour Mode
let state = moodArray[0];
let color = {r: 0, g: 0, b: 0};

let cubeGeo = new THREE.BoxGeometry(1, 1, 1);
let sphereGeo = new THREE.SphereBufferGeometry(5, 32, 32);
let mainMaterial = new THREE.MeshLambertMaterial({color: 0xFFFFFF, wireframe: true, fog: true});

// Initilize Scene, camera, WebGL Renderer & Camera controls
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(90, width / height, 0.1, 10000);
let renderer = new THREE.WebGLRenderer({antialias: true});
let controls = new THREE.OrbitControls(camera, renderer.domElement);
let directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5);
let ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
let pointLight = new THREE.PointLight(0xFFFFFF, 1);

//////////////////////////////////////////////////////////
function setup() // P5 Setup - Microphone set up here
{
    source = new p5.AudioIn();
    source.start();
    peakDetect = new p5.PeakDetect(50, 20000, 0.35, 20);
    fft = new p5.FFT(0.9, 1024);
    fft.setInput(source);
}

// Derive a note from the frequency
function noteFromPitch(frequency) 
{
    let noteText = [ 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2' ];
    noteValue = map(frequency, 0, 12000, 0, 1000)
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    let nnum = Math.round(noteNum) + 69;
    let note = nnum % 12;
    // Push note to noteArray when volume is equal to or greater than 2
    if(volume >= 2)
    {
        noteArray.push(noteText[note]);
    }

    // Determine which array to push notes to
    switch(noteArray[noteArray.length - 1])
    {
        case ('C' || 'C#' || 'D' || 'A' || 'G' || 'G#'): 
            positiveArray.push(noteArray[noteArray.length - 1]);
            positiveArray.sort();
            break;
        case ('E' || 'D#' || 'F' || 'F#' || 'A#' || 'B'):
            negativeArray.push(noteArray[noteArray.length - 1]);
            negativeArray.sort();
            break;
    }

    return noteText[note];
}

function draw() // p5 Draw loop, runs 60x a second
{
    let amplitude = source.getLevel(); // Read in mic volume
    volume = map(amplitude, 0, 1, 1, 10); // Map volume from 0 -> 1, to 1 -> 10
    volume = Math.floor(volume);
    radius = map(amplitude, 0, 10, 1500, 5000)
    spectrum = fft.analyze(); // Analyze spectrum of sound being input
    energy = fft.getEnergy("treble"); // Used to determine if sound is distorted or not
    if(Math.floor(energy / 10) >= 14)
    {
        isDistorted = true;
    }

    else
    {
        isDistorted = false;
    }

    if(volume >= 2) // Set states based distortion and amount of positive notes vs negative notes
    {
        // Blue
        if(isDistorted == false && positiveArray > negativeArray)
        {
            fft.smoothing = 0.9
            state = moodArray[1];
        }

        // Dark Blue
        if(isDistorted == false && negativeArray > positiveArray)
        {
            fft.smoothing = 0.9
            state = moodArray[2];
        }

        // Red
        else if(isDistorted == true && positiveArray > negativeArray)
        {
            fft.smoothing = 0.5
            state = moodArray[3];
        }

        // Dark Red
        else if(isDistorted == true && negativeArray > positiveArray)
        {
            fft.smoothing = 0.5
            state = moodArray[4];
        }
    }

    else if(volume = 1) //Empty arrays and set state to white if no sound is playing
    {
        state = moodArray[0];
        positiveArray.length = 0;
        negativeArray.length = 0;
    }

    // Set colours of scene
    if(state == "white")
    {
        multiplier = 1;
        color = {r: 1, g: 1, b: 1};
    }

    else if(state == "blue" || state == "darkBlue")
    {
        multiplier = 2;
        let invert = map(volume, 0, 10, 0.8, 0);
        color = {r: 0, g: 0, b: (volume * 2) / 10}
    }

    else if(state == "red" || state == "darkRed")
    {
        multiplier = 3;
        color = {r: (volume * 2) / 10, g: 0, b: 0}
    }

    // Detect peaks in sound
    peakDetect.update(fft);
    if(peakDetect.isDetected)
    {
        peak = true;
    }

    else
    {
        peak = false;
    }
    
    let timeDomain = fft.waveform(2048, 'float32');
    let corrBuff = autoCorrelate(timeDomain);
    let freq = findFrequency(corrBuff);
    noteFromPitch(freq);
}

// Creates buffers in chunks of sound, each chunk read and note derived in findFrequency();
function autoCorrelate(buffer) 
{
    let newBuffer = [];
    let nSamples = buffer.length;

    let autocorrelation = [];
    // center clip removes any samples under 0.1
    if (centerClip)
    {
        let cutoff = 0.1;
        for (let i = 0; i < buffer.length; i++) 
        {
            let val = buffer[i];
            buffer[i] = Math.abs(val) > cutoff ? val : 0;
        }
    }

    for (let lag = 0; lag < nSamples; lag++)
    {
        let sum = 0;
        for (let index = 0; index < nSamples; index++)
        {
            let indexLagged = index+lag;
            if (indexLagged < nSamples)
            {
                let sound1 = buffer[index];
                let sound2 = buffer[indexLagged];
                let product = sound1 * sound2;
                sum += product;
            }
        }

        // average to a value between -1 and 1
        newBuffer[lag] = sum/nSamples;
    }

    if (bNormalize)
    {
        let biggestVal = 0;
        for (let index = 0; index < nSamples; index++)
        {
            if (abs(newBuffer[index]) > biggestVal)
            {
                biggestVal = abs(newBuffer[index]);
            }
        }

        for (let index = 0; index < nSamples; index++)
        {
            newBuffer[index] /= biggestVal;
        }
    }

    return newBuffer;
}

// Takes autocorrelated value and measures betweek peaks to find frequency
function findFrequency(autocorr) 
{
    let nSamples = autocorr.length;
    let valOfLargestPeakSoFar = 0;
    let indexOfLargestPeakSoFar = -1;

    for (let index = 1; index < nSamples; index++)
    {
        let valL = autocorr[index-1];
        let valC = autocorr[index];
        let valR = autocorr[index+1];

        let bIsPeak = ((valL < valC) && (valR < valC));
        if (bIsPeak)
        {
            if (valC > valOfLargestPeakSoFar)
            {
                valOfLargestPeakSoFar = valC;
                indexOfLargestPeakSoFar = index;
            }
        }
    }
    
    let distanceToNextLargestPeak = indexOfLargestPeakSoFar - 0;

    // convert sample count to frequency
    let fundamentalFrequency = sampleRate() / distanceToNextLargestPeak;
    return fundamentalFrequency;
}

// Set renderer size, colour, lights and append to body
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor("#000000");
renderer.setPixelRatio( window.devicePixelRatio );
document.body.appendChild(renderer.domElement);
scene.add(directionalLight);
scene.add(ambientLight);
scene.add(pointLight);

// Set default camera position, update controls, add fog
camera.position.set(1615, 170, 1450);
controls.update();
scene.fog = new THREE.Fog('#000000', 500, 3000);

// Listen for window resize, resize accordingly
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect =  window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix();
});

// Soundbar Creation
for(let i = 0; i < specLength; i++)
{
    let soundBar = new THREE.Mesh(cubeGeo, mainMaterial);
    soundBar.position.set((Math.random() * 10000) - 5000, (Math.random() * 10000) - 5000, (Math.random() * 10000) - 5000);
    soundBar.scale.y = Math.random() * 50;
    soundBarArray.push(soundBar);
    scene.add(soundBar);
}

// Cube creation
for(let i = 0; i < specLength; i++)
{
    let cube = new THREE.Mesh(cubeGeo, mainMaterial);
    cube.position.set(0, (i * (width / 100) - 2500), 0);
    cubeArray.push(cube);
    cube.rotation.y += i / 20;
    scene.add(cube);
}

// Tower creation
for(let i = 0; i < specLength; i++)
{
    let tower = new THREE.Mesh(cubeGeo, mainMaterial);
    towersArray.push(tower);
    scene.add(tower);
}

// PeakSphere creation
for(let i = 0; i < specLength; i++)
{
    let peakSphere = new THREE.Mesh(sphereGeo, mainMaterial);
    peakSphere.scale.set(Math.random, Math.random, Math.random);
    peakSphereArray.push(peakSphere);
    scene.add(peakSphere);
} 

// Animate function, runs 60x a second
let count = 1;
let animate = function(time) 
{
    requestAnimationFrame(animate);
    controls.update();
    // Rotate camera
    controls.autoRotate = true;

    // Adjust lights and set renderer colour based on state
    if(state == "white")
    {
        ambientLight.intensity = 100;
        renderer.setClearColor('#777777')
    }

    else if(state == "blue" || state == "darkBlue")
    {
        scene.fog.far = 200;
        ambientLight.intensity = 1;
        renderer.setClearColor('#FFFFFF')
    }

    else if(state == "red" || state == "darkRed")
    {
        scene.fog.far = 3500;
        ambientLight.intensity = 0.5;
        renderer.setClearColor('#000000')
    }

    // Manipulate Centre Helix
    cubeArray.forEach((element, i) => {

        if(state == "blue" || state == "darkBlue")
        {
            element.scale.set((1 + spectrum[i]), 3, 5);
        }

        else if(state == "red" || state == "darkRed")
        {
            element.scale.set((1 + spectrum[i]) * multiplier, 3, 5);
        }

        else if(state == "white")
        {
            element.scale.set(1, 1, 1);
        }
        element.rotation.y += multiplier / 75;
        element.material.color = color;
    })

    // Manipulate Sound Bars
    soundBarArray.forEach((element, i) => {
        
        if(state == "red" || state == "darkRed")
        {
            element.scale.set(1, 0.001 + spectrum[i], 1);
        }

        else
        {
            element.scale.x *= 0.95;
            element.scale.y *= 0.95;
            element.scale.z *= 0.95;
        }
    })

    // Manipulate Spheres
    peakSphereArray.forEach((element, i) => {
        if(state == "blue" || state == "darkBlue" || state == "red" || state == "darkRed")
        {
            if(peak === true)
            {
                element.scale.set((0.01 + spectrum[i]) / 150, (0.01 + spectrum[i]) / 150, (0.01 + spectrum[i]) / 150)
                element.position.set((Math.random() * 5000) - 2500, (Math.random() * 5000) - 2500, (Math.random() * 5000) - 2500);
            }

            else
            {
                element.scale.x *= 0.95;
                element.scale.y *= 0.95;
                element.scale.z *= 0.95;
            }
        } 

        else
            {
                element.scale.x *= 0.95;
                element.scale.y *= 0.95;
                element.scale.z *= 0.95;
            }
    })
    
    // Manipulate frequency ring
    towersArray.forEach((element, i) => {
        element.position.set(Math.sin(i) * radius, 0, Math.cos(i) * radius);
        if(state == "blue" || state == "darkBlue")
        {
            element.position.set((Math.sin(i) * radius) - 50, 0, (Math.cos(i) * radius) - 50);
            element.position.y = 1 + spectrum[i];
            element.scale.set(5, 5, 5);
        }

        else if(state == "red" || state == "darkRed")
        {
            element.position.set((Math.sin(i) * radius), 0, (Math.cos(i) * radius));
            element.position.y = (volume * 10) * Math.random();
            element.scale.y = (1 + spectrum[i]) * 2;
        }
    })

    renderer.render(scene, camera)
};
animate();

// Timothy Hayes - N00161583 - Year 4, Research Project, Phonic View