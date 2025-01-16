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

let videoStateHelper = false;
let clickTimer = null;

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

    setTimeout(() => {
        seekBar.value = 0;
        progressText.innerText = `${formatTime(videoPlayer.duration)}/${formatTime(videoPlayer.currentTime)}`;
    }, 300)

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

        setTimeout(() => {
            ScrollToBottom();
        }, 100);
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
            progressText.innerText = `${formatTime(videoPlayer.duration)}/${formatTime(videoPlayer.currentTime)}`;
        })
        .catch(error => {
            console.error('Error fetching file details:', error);
            FileSize.innerText = 'File Size: Unable to fetch';
        });
    setTimeout(() => {
        ScrollToBottom();
    }, 100);
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
    if (speedSlider.value < 0.07)
        speedSlider.value = 0.07;
    videoPlayer.playbackRate = parseFloat(speedSlider.value);
    speedValue.textContent = `${speedSlider.value}x`;
}

speedSlider.addEventListener('input', (event) => {
    if (speedSlider.step == normalStep) {
    } else {
        // Snap to the closest 0.25 increment when Shift is not pressed
        speedSlider.value = Math.round((parseFloat(speedSlider.value) / snapStep)) * snapStep;
    }

    speedSliderChange();
});

speedSlider.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') {
        speedSlider.step = normalStep;
    }
});

speedSlider.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
        speedSlider.step = snapStep;
        speedSlider.value = Math.round((parseFloat(speedSlider.value) / snapStep)) * snapStep;
    }
    speedSliderChange();
});


function seekVideo() {
    videoPlayer.currentTime = (seekBar.value / 100) * videoPlayer.duration;
}

function seekMouseDown() {
    videoStateHelper = !videoPlayer.paused;
    videoPlayer.pause(); // Pause the video
    seekBar.removeEventListener("mousedown", seekMouseDown);
    seekBar.addEventListener("mouseup", seekMouseUp);
}

function seekMouseUp() {
    if (videoStateHelper)
        videoPlayer.play(); // Resume playing
    seekBar.removeEventListener("mouseup", seekMouseUp);
    seekBar.addEventListener("mousedown", seekMouseDown);
}

seekBar.addEventListener("mousedown", seekMouseDown);


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
            setTimeout(() => {
                ScrollToBottom();
            }, 100);
        });
    }
}

function changeVolume() {
    videoPlayer.volume = volumeSlider.value / 100;
    if(volumeSlider.value==0){

    }
}


function updateTimeDisplay(event) {
    const seekBarRect = seekBar.getBoundingClientRect();
    const mouseX = event.clientX - seekBarRect.left;

    let time = videoPlayer.duration * mouseX / seekBar.offsetWidth;

    if (time < 0 || time > videoPlayer.duration) return;
    timeDisplay.innerText = formatTime(time);
    timeDisplay.style.left = `${mouseX + 95}px`;
    timeDisplay.style.top = "50%";
    timeDisplay.style.display = 'block';
}

function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.round(time % 60);
    return `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
}

seekBar.addEventListener('mouseleave', () => {
    timeDisplay.style.display = 'none';
});

videoPlayer.addEventListener('ended', () => {
    playButton.style.cssText = "";
    playImage.src = "assets/play-icon.png";
    Playing = false;
});


function videoMouseDown() {
    clickTimer = setTimeout(() => {
        clickTimer = null; // Clear the timer to indicate it was a hold
    }, 200);
}

function videoMouseUp() {
    if (clickTimer) {
        // If the timer is still active, it's a click
        clearTimeout(clickTimer);
        clickTimer = null;
        playPause();
    }
}

videoPlayer.addEventListener("mousedown", videoMouseDown);
videoPlayer.addEventListener("mouseup", videoMouseUp);
