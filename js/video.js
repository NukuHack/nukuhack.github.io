console.log('Hello World - just testing stuff');

// https://github.com/search?q=https%3A%2F%2Fwww.pornhub.com%2Fembed%2F+language%3AHTML&type=code


const overlay = document.getElementById('overlay');
const videoPlayer = document.getElementById('videoPlayer');
const videoContainer = document.getElementById("videoContainer");
const seekBar = document.getElementById("seekBar");
const volumeSlider = document.getElementById("volumeSlider");
const timeDisplay = document.getElementById("timeDisplay");
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById("speedValue");
const playImage = document.getElementById("playImage");
const loopImage = document.getElementById("loopImage");
const fullscreenImage = document.getElementById("fullscreenImage");
const fullscreenButton = document.getElementById("fullscreenButton");
const playButton = document.getElementById("playButton");
const loopButton = document.getElementById("loopButton");
const progressText = document.getElementById("progressText");

let FileName = document.getElementById('fileName');
let FileSize = document.getElementById('fileSize');

const normalStep = 0.01;
const snapStep = 0.25;

let Playing = false;
let Fullscreen = false;
let Looping = false;

function resetALL() {
    if (Playing) {
        Playing = false;
        videoPlayer.pause();
        playButton.style.cssText = "";
        playImage.src = "assets/play-icon.png";
    }
    if (Fullscreen) {
        Fullscreen = false;
        document.exitFullscreen().then(() => {
            fullscreenImage.src = "assets/fullscreen-icon.png";
            fullscreenButton.style.cssText = "";
            overlay.style.cssText = "";
        });
    }
    if (Looping) {
        Looping = false;
        videoPlayer.loop = false
        loopButton.style.cssText = "";
        loopImage.src = "assets/loop-icon.png";
    }

    setTimeout(()=>{
        seekBar.value = 0;
        progressText.innerText = `${formatTime(videoPlayer.duration)}/${formatTime(videoPlayer.currentTime)}`;
    },300)

}




function handleFileSelection(event) {
    const selectedFile = event.target.files[0];

    if (selectedFile && isVideo(selectedFile)) {
        displayVideo(selectedFile);
    } else {
        document.getElementById('videoContainer').style.display = 'none';
    }

    // Function to check if the file is a video
    function isVideo(file) {
        const videoMimeTypes = ["video/mp4", "video/webm", "video/ogg", "video/avi", "video/mkv"];
        return videoMimeTypes.includes(file.type);
    }
}


function displayVideo(file) {
    document.getElementById("fileSelect").innerText = "Select another File";

    FileName.innerText = 'Loading...';
    FileSize.innerHTML = '<br>';

    let fileUrl;

    if (file instanceof File) {
        // Handle user-uploaded file
        fileUrl = URL.createObjectURL(file);
        FileName.innerText = `File Name: ${file.name}`;
        FileSize.innerText = `File Size: ${formatFileSize(file.size)}`;
    } else {
        fileUrl = file;
        FileName.innerText = `File Name: ${file.split('/').pop()}`;
        FileSize.innerText = 'File Size: Fetching...';

        fetchAndSetFileSize(fileUrl);
    }

    videoPlayer.src = fileUrl;
    videoContainer.style.display = 'block';
    document.getElementById("fileDetails").style.display = "block";

    resetALL();
}

function fetchAndSetFileSize(videoSrc) {

    fetch(videoSrc)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            const size = formatFileSize(blob.size);
            FileSize.innerText = `File Size: ${size}`;
        })
        .catch(error => {
            console.error('Error fetching file details:', error);
            FileSize.innerText = 'File Size: Unable to fetch';
        });
}


function formatFileSize(fileSize) {
    if (!fileSize) return;
    const units = ['bytes', 'kilobytes', 'megabytes', 'gigabytes', 'terabytes'];
    for (let i = 1; i < units.length; i++) {
        if (fileSize < (1024 ** i) * 15)
            return `${Math.round(fileSize / 1024 ** (i - 1))} ${units[i - 1]}`;
    }
    return "Waaay too big";
}


videoPlayer.addEventListener("timeupdate", () => {
    seekBar.value = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    progressText.innerText = `${formatTime(videoPlayer.duration)}/${formatTime(videoPlayer.currentTime)}`;
});

function playPause() {
    if (videoPlayer.paused) {
        videoPlayer.play();
        playButton.style.backgroundColor = "#aaaaaa";
        playImage.src = "assets/pause-icon.png";
        Playing = true;
    } else {
        videoPlayer.pause();
        playButton.style.cssText = "";
        playImage.src = "assets/play-icon.png";
        Playing = false;
    }
}

function loop() {
    if (!videoPlayer.loop) {
        videoPlayer.loop = true;
        loopButton.style.backgroundColor = "#aaaaaa";
        loopImage.src = "assets/unloop-icon.png";
        Looping = true;
    } else {
        videoPlayer.loop = false
        loopButton.style.cssText = "";
        loopImage.src = "assets/loop-icon.png";
        Looping = false;
    }
}

function setTime(x) {
    videoPlayer.currentTime += x;
}


function speedSliderChange() {
    videoPlayer.playbackRate = parseFloat(speedSlider.value);
    speedValue.textContent = `${speedSlider.value}x`;
}

speedSlider.addEventListener('input', (event) => {
    if (event.shiftKey) {
        // Snap to the closest 0.25 increment when Shift is pressed
        speedSlider.value = Math.round((parseFloat(speedSlider.value) / snapStep)) * snapStep - 0.1;
    }
    speedSliderChange();
});

speedSlider.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') {
        speedSlider.step = snapStep;
    }
});

speedSlider.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
        speedSlider.step = normalStep;
    }
});


function seekVideo() {
    videoPlayer.currentTime = (seekBar.value / 100) * videoPlayer.duration;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch((err) => {
            console.error("Error attempting to enter fullscreen mode: " + err.message);
        }).then(() => {
            fullscreenButton.style.backgroundColor = "#aaaaaa";
            fullscreenImage.src = "assets/minimize-icon.png";
            overlay.style.top = "90%";
            Fullscreen = true;
        });
    } else {
        document.exitFullscreen().then(() => {
            fullscreenImage.src = "assets/fullscreen-icon.png";
            fullscreenButton.style.cssText = "";
            overlay.style.cssText = "";
            Fullscreen = false;
        });
    }
}

function changeVolume() {
    videoPlayer.volume = calculateVolume(volumeSlider.value) / 100;
}

function calculateVolume(sliderValue) {
    if (sliderValue <= 50) return Math.round(sliderValue * (40 / 50));
    else if (sliderValue <= 70) return Math.round(60 + (sliderValue - 60) * (40 / 30));
    else return Math.round(70 + (sliderValue - 70) * (40 / 40));
}

function updateTimeDisplay(event) {
    const seekBarRect = seekBar.getBoundingClientRect();
    const mouseX = event.clientX - seekBarRect.left;
    const transitionAmount = videoPlayer.duration / 56;
    const middlePoint = videoPlayer.duration / 2;

    let time = videoPlayer.duration * mouseX / seekBar.offsetWidth;
    time = adjustTime(time, middlePoint, transitionAmount);

    if (time < 0 || time > videoPlayer.duration) return;
    timeDisplay.innerText = formatTime(time);
    timeDisplay.style.left = `${mouseX+95}px`;
    timeDisplay.style.top = "50%";
    timeDisplay.style.display = 'block';
}

function adjustTime(time, middlePoint, transitionAmount) {
    if (time < middlePoint)
        time -= transitionAmount * (1 - (time / middlePoint) ** 2);
    else
        time += transitionAmount * ((time - middlePoint) / (videoPlayer.duration - middlePoint)) ** 2;

    return time;
}

function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.round(time % 60);
    return `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
}

seekBar.addEventListener('mouseleave', () => {
    timeDisplay.style.display = 'none';
});

videoPlayer.addEventListener("ended", () => {
    seekBar.value = 0;
});
