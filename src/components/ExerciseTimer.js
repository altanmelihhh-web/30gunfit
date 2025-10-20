import React, { useState, useEffect, useRef } from 'react';
import './ExerciseTimer.css';

function ExerciseTimer({ exercise, onComplete }) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [initialTime, setInitialTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [phase, setPhase] = useState('ready'); // ready, work, rest, complete
  const [currentSet, setCurrentSet] = useState(1);
  const [totalSets, setTotalSets] = useState(1);
  const [repsPerSet, setRepsPerSet] = useState(0);
  const [currentRep, setCurrentRep] = useState(0);
  const [showMedia, setShowMedia] = useState(true);
  const [mediaType, setMediaType] = useState('gif'); // 'gif' veya 'video'
  const intervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const utteranceRef = useRef(null);
  const lastSpokenRep = useRef(0);
  const lastMotivationTime = useRef(0);

  // Motivasyon mesajları
  const motivationMessages = [
    'Harika gidiyorsun!',
    'Devam et, çok iyi!',
    'Formunu koru!',
    'Nefes almayı unutma!',
    'Mükemmel!',
    'Süpersin!',
    'Hadi pes etme!',
    'Çok yaklaştın!',
    'Efsanesin!',
    'Birazcık daha!'
  ];

  const formReminders = [
    'Sırtını dik tut',
    'Nefes al, nefes ver',
    'Kontrolü kaybetme',
    'Yavaş ve kontrollü',
    'Kaslarını hisset'
  ];

  // Egzersiz bilgilerini parse et
  useEffect(() => {
    if (!exercise) return;

    // Duration dakika cinsinden (örn: 3 dakika = 3)
    let duration = exercise.duration || 0;
    let calculatedTime = duration * 60; // Varsayılan: dakikayı saniyeye çevir

    // Set ve tekrar bilgisini parse et
    if (typeof exercise.reps === 'string') {
      const setMatch = exercise.reps.match(/(\d+)\s*set\s*×\s*(\d+)\s*tekrar/);
      if (setMatch) {
        const sets = parseInt(setMatch[1]);
        const reps = parseInt(setMatch[2]);
        setTotalSets(sets);
        setRepsPerSet(reps);
        calculatedTime = duration * 60;
      } else if (exercise.reps.includes('dakika')) {
        const mins = parseInt(exercise.reps);
        if (mins > 0) {
          duration = mins; // Reps'teki dakika bilgisini kullan
          calculatedTime = mins * 60;
        }
      } else if (exercise.reps.includes('tekrar')) {
        const reps = parseInt(exercise.reps);
        setRepsPerSet(reps);
        // Her tekrar için yaklaşık süre hesapla
        calculatedTime = Math.max(duration * 60, reps * 2);
      }
    }

    setTimeLeft(calculatedTime);
    setInitialTime(calculatedTime);

    console.log('Timer initialized:', {
      exerciseName: exercise.name,
      duration: duration,
      reps: exercise.reps,
      calculatedTimeInSeconds: calculatedTime
    });
  }, [exercise]);

  // Sesli komut fonksiyonu
  const speak = (text, options = {}) => {
    if (!window.speechSynthesis) return;

    // Önceki konuşmayı iptal et
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Bip sesi çal
  const playBeep = (frequency = 800, duration = 200) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  };

  // Timer başlat
  const startTimer = () => {
    setIsRunning(true);
    setIsPaused(false);
    setPhase('work');
    speak(`${exercise.name} başlıyor. Hazır ol!`);
    playBeep(1000, 300);
  };

  // Timer duraklat/devam
  const togglePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      speak('Duraklatıldı');
    } else {
      speak('Devam ediyoruz');
      playBeep(600, 200);
    }
  };

  // Timer sıfırla
  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setPhase('ready');
    setCurrentSet(1);
    setTimeLeft(initialTime);
    window.speechSynthesis.cancel();
  };

  // Rastgele motivasyon mesajı seç
  const getRandomMotivation = () => {
    return motivationMessages[Math.floor(Math.random() * motivationMessages.length)];
  };

  const getRandomFormReminder = () => {
    return formReminders[Math.floor(Math.random() * formReminders.length)];
  };

  // Timer mantığı
  useEffect(() => {
    if (!isRunning || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const elapsed = initialTime - prev;

        // Süre bitti
        if (prev <= 1) {
          // Set bazlı egzersiz mi?
          if (totalSets > 1 && currentSet < totalSets) {
            // Dinlenme süresi (15 saniye)
            setPhase('rest');
            speak(`${currentSet}. set tamamlandı. 15 saniye dinlen.`);
            playBeep(600, 300);
            setCurrentSet(currentSet + 1);
            setCurrentRep(0);
            lastSpokenRep.current = 0;
            return 15;
          } else {
            // Egzersiz tamamen bitti
            setPhase('complete');
            setIsRunning(false);
            speak('Harika! Egzersiz tamamlandı. Bravo!', { pitch: 1.2 });
            playBeep(1200, 500);
            if (onComplete) {
              setTimeout(() => onComplete(), 2000);
            }
            return 0;
          }
        }

        // Tekrar sayma (her 3 saniyede bir tekrar varsayımıyla)
        if (repsPerSet > 0 && phase === 'work') {
          const secondsPerRep = Math.floor(initialTime / repsPerSet);
          const estimatedRep = Math.floor(elapsed / Math.max(secondsPerRep, 2));

          if (estimatedRep > lastSpokenRep.current && estimatedRep <= repsPerSet) {
            lastSpokenRep.current = estimatedRep;
            setCurrentRep(estimatedRep);

            // Her tekrarı say
            speak(estimatedRep.toString(), { rate: 1.1 });
            playBeep(900, 100);

            // Her 5 tekrarda motivasyon
            if (estimatedRep % 5 === 0 && estimatedRep < repsPerSet) {
              setTimeout(() => speak(getRandomMotivation()), 800);
            }

            // Her 10 tekrarda form hatırlatması
            if (estimatedRep % 10 === 0 && estimatedRep < repsPerSet) {
              setTimeout(() => speak(getRandomFormReminder()), 1500);
            }
          }

          // Kalan tekrar uyarısı
          const remaining = repsPerSet - estimatedRep;
          if (remaining === 10 || remaining === 5) {
            speak(`${remaining} tekrar kaldı! Hadi!`, { rate: 1.1 });
          }
        }

        // Sesli geri sayım (son 5 saniye)
        if (prev <= 5 && prev > 0 && phase === 'work') {
          speak(prev.toString(), { rate: 1.2 });
          playBeep(800, 150);
        }

        // Yarı süre uyarısı
        if (prev === Math.floor(initialTime / 2) && phase === 'work') {
          speak('Yarıladın, devam et! ' + getRandomMotivation());
        }

        // Çeyrek sürelerde motivasyon
        if (prev === Math.floor(initialTime * 0.75) && phase === 'work') {
          speak(getRandomMotivation());
        }
        if (prev === Math.floor(initialTime * 0.25) && phase === 'work') {
          speak('Son düzlük! ' + getRandomMotivation());
        }

        // Her 30 saniyede bir form hatırlatması
        const now = Date.now();
        if (now - lastMotivationTime.current > 30000 && phase === 'work') {
          lastMotivationTime.current = now;
          speak(getRandomFormReminder());
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, currentSet, totalSets, phase, repsPerSet, onComplete, initialTime]);

  // Component unmount olduğunda temizle
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercent = () => {
    if (initialTime === 0) return 0;
    return Math.max(0, Math.min(100, ((initialTime - timeLeft) / initialTime) * 100));
  };

  return (
    <div className={`exercise-timer ${phase}`}>
      <div className="timer-header">
        <h4>{exercise.name}</h4>
        {totalSets > 1 && (
          <span className="set-indicator">
            Set {currentSet}/{totalSets}
          </span>
        )}
      </div>

      {/* Media Gösterimi */}
      {showMedia && (exercise.gifUrl || exercise.videoUrl) && (
        <div className="timer-gif-section">
          <div className="gif-controls">
            {/* Hem GIF hem Video varsa seçim butonları */}
            {exercise.gifUrl && exercise.videoUrl && (
              <div className="media-toggle-timer">
                <button
                  className={`media-btn-timer ${mediaType === 'gif' ? 'active' : ''}`}
                  onClick={() => setMediaType('gif')}
                >
                  🎬 GIF
                </button>
                <button
                  className={`media-btn-timer ${mediaType === 'video' ? 'active' : ''}`}
                  onClick={() => setMediaType('video')}
                >
                  📹 Video
                </button>
              </div>
            )}
            <button
              className="gif-toggle-btn"
              onClick={() => setShowMedia(!showMedia)}
            >
              {showMedia ? '⚡ Gizle' : '🎬 Göster'}
            </button>
          </div>

          {/* GIF gösterimi */}
          {exercise.gifUrl && (mediaType === 'gif' || !exercise.videoUrl) && (
            <img
              src={exercise.gifUrl}
              alt={exercise.name}
              className="timer-gif"
              loading="lazy"
            />
          )}

          {/* Video gösterimi */}
          {exercise.videoUrl && (mediaType === 'video' || !exercise.gifUrl) && (
            <div className="timer-video-wrapper">
              <iframe
                src={exercise.videoUrl}
                title={`${exercise.name} gösterimi`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                loading="lazy"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}

      {!showMedia && (exercise.gifUrl || exercise.videoUrl) && (
        <button
          className="gif-toggle-btn-small"
          onClick={() => setShowMedia(true)}
        >
          🎬 {exercise.gifUrl && exercise.videoUrl ? 'GIF/Video' : exercise.gifUrl ? 'GIF' : 'Video'} Göster
        </button>
      )}

      <div className="timer-display">
        <div className="time-circle">
          <svg className="timer-ring" viewBox="0 0 100 100">
            <circle
              className="timer-ring-bg"
              cx="50"
              cy="50"
              r="45"
            />
            <circle
              className="timer-ring-progress"
              cx="50"
              cy="50"
              r="45"
              style={{
                strokeDasharray: `${2 * Math.PI * 45}`,
                strokeDashoffset: `${2 * Math.PI * 45 * (1 - getProgressPercent() / 100)}`
              }}
            />
          </svg>
          <div className="time-text">
            {formatTime(timeLeft)}
          </div>
        </div>
        {repsPerSet > 0 && phase === 'work' && currentRep > 0 && (
          <p className="reps-indicator">
            <span className="current-rep">{currentRep}</span> / {repsPerSet} tekrar
          </p>
        )}
        {repsPerSet === 0 && phase === 'work' && (
          <p className="reps-indicator">
            Devam ediyor...
          </p>
        )}
      </div>

      <div className="timer-controls">
        {!isRunning && phase === 'ready' && (
          <button className="btn-start" onClick={startTimer}>
            🏃 Başla
          </button>
        )}

        {isRunning && (
          <>
            <button className="btn-pause" onClick={togglePause}>
              {isPaused ? '▶️ Devam' : '⏸️ Duraklat'}
            </button>
            <button className="btn-reset" onClick={resetTimer}>
              🔄 Sıfırla
            </button>
          </>
        )}

        {phase === 'complete' && (
          <button className="btn-complete" onClick={resetTimer}>
            ✅ Tekrar Yap
          </button>
        )}
      </div>

      <div className="timer-status">
        {phase === 'ready' && <span className="status-ready">Hazır</span>}
        {phase === 'work' && <span className="status-work">Çalışıyor 💪</span>}
        {phase === 'rest' && <span className="status-rest">Dinlenme 😌</span>}
        {phase === 'complete' && <span className="status-complete">Tamamlandı! 🎉</span>}
      </div>
    </div>
  );
}

export default ExerciseTimer;
