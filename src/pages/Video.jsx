import { useRef, useState } from 'react';
import '../styles/video.css';

const ICONS = {
  volume: '/assets/volume-icon.png',
  doubleLeft: '/assets/double-left-arrow.png',
  doubleRight: '/assets/double-right-arrow.png',
  singleRight: '/assets/single-right-arrow.png',
  singleLeft: '/assets/single-left-arrow.png',
  speed: '/assets/speed-icon.png',
  loop: '/assets/loop-icon.png',
  unloop: '/assets/unloop-icon.png',
  play: '/assets/play-icon.png',
  pause: '/assets/pause-icon.png',
  fullscreen: '/assets/fullscreen-icon.png',
  minimize: '/assets/minimize-icon.png',
};

const NORMAL_STEP = 0.01;
const SNAP_STEP = 0.25;

function formatTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.round(time % 60);
  return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
}

function formatFileSize(fileSize) {
  if (!fileSize) return '';
  const units = ['bytes', 'kilobytes', 'megabytes', 'gigabytes', 'terabytes'];
  for (let i = 1; i < units.length; i++) {
    if (fileSize < 1024 ** i * 15) return `${Math.round(fileSize / 1024 ** (i - 1))} ${units[i - 1]}`;
  }
  return 'Waaay too big';
}

export default function Video() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const videoContainerRef = useRef(null);
  const seekBarRef = useRef(null);
  const speedSliderRef = useRef(null);
  const timeDisplayRef = useRef(null);
  const progressTextRef = useRef(null);
  const fullscreenButtonRef = useRef(null);
  const playButtonRef = useRef(null);
  const loopButtonRef = useRef(null);

  const wasPlayingBeforeSeekRef = useRef(false);
  const clickTimerRef = useRef(null);

  const [showVideo, setShowVideo] = useState(false);
  const [fileSelectLabel, setFileSelectLabel] = useState('Select a File');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');

  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [speedDisplay, setSpeedDisplay] = useState('1x');

  function updateProgressText() {
    const v = videoRef.current;
    if (progressTextRef.current && v) {
      progressTextRef.current.innerText = `${formatTime(v.duration)}/${formatTime(v.currentTime)}`;
    }
  }

  function resetAll() {
    const v = videoRef.current;
    if (playing) {
      setPlaying(false);
      v.pause();
    }
    if (fullscreen) {
      setFullscreen(false);
      document.exitFullscreen?.().then(() => {
        if (overlayRef.current) overlayRef.current.style.cssText = '';
      });
    }
    if (looping) {
      setLooping(false);
      v.loop = false;
    }

    setTimeout(() => {
      if (seekBarRef.current) seekBarRef.current.value = 0;
      updateProgressText();
    }, 300);
  }

  function displayVideo(file) {
    setFileSelectLabel('Select another File');
    setFileName('Loading...');
    setFileSize('');

    let fileUrl;
    if (file instanceof File) {
      fileUrl = URL.createObjectURL(file);
      setFileName(`File Name: ${file.name}`);
      setFileSize(`File Size: ${formatFileSize(file.size)}`);
      setTimeout(() => window.scrollTo({ top: 10000, behavior: 'smooth' }), 100);
    } else {
      fileUrl = file;
      setFileName(`File Name: ${file.split('/').pop()}`);
      setFileSize('File Size: Fetching...');
      fetchAndSetFileSize(fileUrl);
    }

    videoRef.current.src = fileUrl;
    setShowVideo(true);
    resetAll();
  }

  function fetchAndSetFileSize(videoSrc) {
    fetch(videoSrc)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        setFileSize(`File Size: ${formatFileSize(blob.size)}`);
        updateProgressText();
      })
      .catch((error) => {
        console.error('Error fetching file details:', error);
        setFileSize('File Size: Unable to fetch');
      });
    setTimeout(() => window.scrollTo({ top: 10000, behavior: 'smooth' }), 100);
  }

  function handleFileSelection(e) {
    const selectedFile = e.target.files[0];
    const videoMimeTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mkv'];

    if (selectedFile && videoMimeTypes.includes(selectedFile.type)) {
      displayVideo(selectedFile);
    } else {
      setShowVideo(false);
    }
  }

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (seekBarRef.current) seekBarRef.current.value = (v.currentTime / v.duration) * 100;
    updateProgressText();
  }

  function playPause() {
    const v = videoRef.current;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleLoop() {
    const v = videoRef.current;
    v.loop = !v.loop;
    setLooping(v.loop);
  }

  function setTime(delta) {
    videoRef.current.currentTime += delta;
  }

  function applySpeed(value) {
    const v = Math.max(0.07, parseFloat(value));
    videoRef.current.playbackRate = v;
    setSpeedDisplay(`${value}x`);
  }

  function handleSpeedInput() {
    const slider = speedSliderRef.current;
    if (slider.step != NORMAL_STEP) {
      slider.value = Math.round(parseFloat(slider.value) / SNAP_STEP) * SNAP_STEP;
    }
    applySpeed(slider.value);
  }

  function handleSpeedKeyDown(e) {
    if (e.key === 'Shift' && speedSliderRef.current) speedSliderRef.current.step = NORMAL_STEP;
  }

  function handleSpeedKeyUp(e) {
    const slider = speedSliderRef.current;
    if (e.key === 'Shift' && slider) {
      slider.step = SNAP_STEP;
      slider.value = Math.round(parseFloat(slider.value) / SNAP_STEP) * SNAP_STEP;
    }
    applySpeed(slider.value);
  }

  function seekVideo() {
    const v = videoRef.current;
    v.currentTime = (seekBarRef.current.value / 100) * v.duration;
  }

  function handleSeekMouseDown() {
    const v = videoRef.current;
    wasPlayingBeforeSeekRef.current = !v.paused;
    v.pause();
  }

  function handleSeekMouseUp() {
    if (wasPlayingBeforeSeekRef.current) videoRef.current.play();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      videoContainerRef.current
        .requestFullscreen()
        .catch((err) => console.error('Error attempting to enter fullscreen mode: ' + err.message))
        .then(() => {
          if (overlayRef.current) overlayRef.current.style.top = '90%';
          setFullscreen(true);
        });
    } else {
      document.exitFullscreen().then(() => {
        if (overlayRef.current) overlayRef.current.style.cssText = '';
        setFullscreen(false);
        setTimeout(() => window.scrollTo({ top: 10000, behavior: 'smooth' }), 100);
      });
    }
  }

  function changeVolume(e) {
    videoRef.current.volume = e.target.value / 100;
  }

  function updateTimeDisplay(event) {
    const v = videoRef.current;
    const seekBarRect = seekBarRef.current.getBoundingClientRect();
    const mouseX = event.clientX - seekBarRect.left;
    const time = (v.duration * mouseX) / seekBarRef.current.offsetWidth;

    if (time < 0 || time > v.duration || !timeDisplayRef.current) return;
    timeDisplayRef.current.innerText = formatTime(time);
    timeDisplayRef.current.style.left = `${mouseX + 95}px`;
    timeDisplayRef.current.style.top = '50%';
    timeDisplayRef.current.style.display = 'block';
  }

  function hideTimeDisplay() {
    if (timeDisplayRef.current) timeDisplayRef.current.style.display = 'none';
  }

  function handleEnded() {
    setPlaying(false);
  }

  function handleVideoMouseDown() {
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
    }, 200);
  }

  function handleVideoMouseUp() {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      playPause();
    }
  }

  return (
    <>
      <section id="fileSelection">
        <button
          className="fileSelect"
          id="fileSelect"
          aria-label="Select a file to display"
          onClick={() => document.getElementById('fileInput').click()}
        >
          {fileSelectLabel}
        </button>
        <button
          className="fileSelect"
          id="fileSelectDemo"
          aria-label="Select a file to display"
          onClick={() => displayVideo('/public/resources/demo.mp4')}
        >
          Try the demo File
        </button>

        <input type="file" id="fileInput" onChange={handleFileSelection} accept="*" />
      </section>

      <section id="fileDetails" style={{ display: fileName ? 'block' : 'none' }}>
        <p id="fileName">{fileName}</p>
        <p id="fileSize">{fileSize}</p>
      </section>

      <div id="videoContainer" ref={videoContainerRef} style={{ display: showVideo ? 'block' : 'none' }}>
        <video
          id="videoPlayer"
          ref={videoRef}
          aria-labelledby="videoControls"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onMouseDown={handleVideoMouseDown}
          onMouseUp={handleVideoMouseUp}
        >
          Your browser does not support the video tag.
        </video>

        <div className="overlay" id="overlay" ref={overlayRef}>
          <div className="control-inline">
            <div className="control-buttons">
              <button
                onClick={playPause}
                aria-label="Play/Pause"
                id="playButton"
                ref={playButtonRef}
                className="small-buttons"
                style={playing ? { backgroundColor: '#aaaaaa' } : undefined}
              >
                <img className="video-img" src={playing ? ICONS.pause : ICONS.play} alt="Play/Pause" />
              </button>
              <button onClick={() => setTime(-5)} aria-label="Rewind 5 seconds" id="small-backw-button" className="small-buttons">
                <img className="video-img" src={ICONS.singleLeft} alt="Rewind 5 seconds" />
              </button>
              <button onClick={() => setTime(-10)} aria-label="Rewind 10 seconds" id="big-backw-button" className="small-buttons">
                <img className="video-img" src={ICONS.doubleLeft} alt="Rewind 10 seconds" />
              </button>
              <button onClick={() => setTime(10)} aria-label="Forward 10 seconds" id="big-forw-button" className="small-buttons">
                <img className="video-img" src={ICONS.doubleRight} alt="Forward 10 seconds" />
              </button>
              <button onClick={() => setTime(5)} aria-label="Forward 5 seconds" id="small-forw-button" className="small-buttons">
                <img className="video-img" src={ICONS.singleRight} alt="Forward 5 seconds" />
              </button>
              <button
                onClick={toggleLoop}
                aria-label="Toggle Loop"
                id="loopButton"
                ref={loopButtonRef}
                className="small-buttons"
                style={looping ? { backgroundColor: '#aaaaaa' } : undefined}
              >
                <img className="video-img" src={looping ? ICONS.unloop : ICONS.loop} alt="Toggle Loop" />
              </button>
            </div>

            <div className="slider-controls">
              <label htmlFor="speedSlider">
                <img className="video-img" src={ICONS.speed} alt="Speed" />
              </label>
              <input
                type="range"
                id="speedSlider"
                ref={speedSliderRef}
                min="0"
                max="2"
                step={SNAP_STEP}
                defaultValue="1"
                onInput={handleSpeedInput}
                onKeyDown={handleSpeedKeyDown}
                onKeyUp={handleSpeedKeyUp}
                aria-labelledby="speedSlider"
              />
              <p id="speedValue">{speedDisplay}</p>
              <label htmlFor="volumeSlider">
                <img className="video-img" src={ICONS.volume} alt="Volume" />
              </label>
              <input
                type="range"
                id="volumeSlider"
                defaultValue="100"
                max="100"
                onInput={changeVolume}
                aria-labelledby="volumeControl"
              />
            </div>

            <button
              id="fullscreenButton"
              ref={fullscreenButtonRef}
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              style={fullscreen ? { backgroundColor: '#aaaaaa' } : undefined}
            >
              <img className="video-img" src={fullscreen ? ICONS.minimize : ICONS.fullscreen} alt="Fullscreen" />
            </button>
          </div>
          <div className="time-control">
            <label htmlFor="seekBar" id="progressText" ref={progressTextRef}>
              Progress:
            </label>
            <input
              type="range"
              id="seekBar"
              ref={seekBarRef}
              min="0"
              defaultValue="0"
              max="100"
              step="0.01"
              onInput={seekVideo}
              onMouseDown={handleSeekMouseDown}
              onMouseUp={handleSeekMouseUp}
              onMouseMove={updateTimeDisplay}
              onMouseLeave={hideTimeDisplay}
              aria-labelledby="seekBar"
            />
            <div id="timeDisplay" ref={timeDisplayRef} aria-live="polite" />
          </div>
        </div>
      </div>
    </>
  );
}
