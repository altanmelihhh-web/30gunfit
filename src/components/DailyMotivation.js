import React, { useMemo } from 'react';
import './DailyMotivation.css';

function DailyMotivation({ completedDays, currentDay, streak }) {
  // Motivasyon mesajları koleksiyonu
  const motivationQuotes = useMemo(() => [
    {
      message: "Bugün kendine yatırım yapmanın tam zamanı!",
      author: "Sen",
      emoji: "💪"
    },
    {
      message: "Küçük adımlar, büyük değişimler yaratır.",
      author: "Anonim",
      emoji: "🚀"
    },
    {
      message: "Güçlü vücut, güçlü zihin. Haydi başla!",
      author: "Fitness Mantrası",
      emoji: "🧠"
    },
    {
      message: "Yarın başlayacağım diyenler, asla başlamaz.",
      author: "Bilge Söz",
      emoji: "⏰"
    },
    {
      message: "30 dakikan yok derken, 30 yılını kaybediyorsun.",
      author: "Sağlık Uzmanları",
      emoji: "⚡"
    },
    {
      message: "En zor adım, ilk adımdır. Sen çoktan attın!",
      author: "Motivasyon",
      emoji: "🎯"
    },
    {
      message: "Vücudun yapabileceklerini düşündüğün her şeyin ötesinde!",
      author: "Fitness",
      emoji: "🏆"
    },
    {
      message: "Egzersiz yapmak için çok yorgunum deme. Yorgunluktan kurtulmak için egzersiz yap!",
      author: "Wellness",
      emoji: "✨"
    },
    {
      message: "İmkansız, seni durdurmaya çalışan bir kelimeden ibaret.",
      author: "Motivasyon",
      emoji: "🔥"
    },
    {
      message: "Kendinle yarış, başkalarıyla değil. Dünkü halinden daha iyi ol!",
      author: "Personal Growth",
      emoji: "📈"
    },
    {
      message: "Sonuçlar hemen gelmez, ama her gün biraz daha yaklaşırsın.",
      author: "Sabır",
      emoji: "🌱"
    },
    {
      message: "Gerekçeler değil, sonuçlar üret!",
      author: "Action Taker",
      emoji: "💥"
    },
    {
      message: "Bugünkü acı, yarının gücüdür.",
      author: "Fitness Wisdom",
      emoji: "💎"
    },
    {
      message: "30 gün sonra bugün başlamış olmayı dileyeceksin. O gün bugün!",
      author: "Zaman Yolcusu",
      emoji: "⏳"
    },
    {
      message: "Sen yapabilirsin! İnan, çalış, başar!",
      author: "İç Ses",
      emoji: "🌟"
    },
    {
      message: "Sınırların kafandadır. Vücudun hazır, zihnini hazırla!",
      author: "Mental Coach",
      emoji: "🧘"
    },
    {
      message: "Her gün bir adım, her adım bir kazanım!",
      author: "Progress",
      emoji: "👣"
    },
    {
      message: "Yorgunluk geçicidir, başarı kalıcıdır.",
      author: "Winner Mindset",
      emoji: "🥇"
    },
    {
      message: "Düşeceğin değil, kalkacağın önemli. Hadi kalk!",
      author: "Resilience",
      emoji: "🦅"
    },
    {
      message: "Vücuduna iyi bak, başka yaşayacak yerin yok!",
      author: "Sağlık",
      emoji: "❤️"
    },
    {
      message: "Hareketsiz kalma, o zaman her şey zorlaşır. Hareket et!",
      author: "Movement",
      emoji: "🏃"
    },
    {
      message: "Bugün egzersiz yap, yarın teşekkür et kendine!",
      author: "Future You",
      emoji: "🙏"
    },
    {
      message: "Disiplin motivasyondan güçlüdür. Disiplinli ol!",
      author: "Success Habit",
      emoji: "📚"
    },
    {
      message: "1% daha iyi olmak için bugün ne yapacaksın?",
      author: "Kaizen",
      emoji: "📊"
    },
    {
      message: "Dinlenme günleri de önemli, ama bugün dinlenme günü değil!",
      author: "Training",
      emoji: "💪"
    },
    {
      message: "Formunu koru, hızını değil. Kalite her zaman kazanır!",
      author: "Form First",
      emoji: "✅"
    },
    {
      message: "Su iç, hareket et, nefes al. Hayat bu kadar basit!",
      author: "Basics",
      emoji: "💧"
    },
    {
      message: "Egzersiz sadece vücudun için değil, ruhun için de!",
      author: "Holistic Health",
      emoji: "🌈"
    },
    {
      message: "Ağrı geçicidir, gurur kalıcıdır!",
      author: "No Pain No Gain",
      emoji: "🔥"
    },
    {
      message: "30 günlük yolculuğun her adımında yanındayız!",
      author: "30 Gün Fit",
      emoji: "🤝"
    }
  ], []);

  // Streak'e özel motivasyon mesajları
  const streakMessages = {
    0: {
      message: "Bugün yeni bir başlangıç! İlk adımını at!",
      emoji: "🌅"
    },
    1: {
      message: "İlk günü tamamladın! Momentumu koru!",
      emoji: "🎯"
    },
    3: {
      message: "3 gün streak! Alışkanlık oluşuyor! 🔥",
      emoji: "🔥"
    },
    7: {
      message: "1 hafta tamamlandı! Sen bir şampiyonsun! 🏆",
      emoji: "🏆"
    },
    14: {
      message: "2 hafta streak! İnanılmaz bir disiplin! 💎",
      emoji: "💎"
    },
    21: {
      message: "21 gün! Artık bu bir alışkanlık! 🌟",
      emoji: "🌟"
    },
    30: {
      message: "30 GÜN TAMAMLANDI! EFSANESIN! 👑",
      emoji: "👑"
    }
  };

  // Günlük mesaj seç (gün sayısına göre)
  const dailyQuote = useMemo(() => {
    const index = currentDay % motivationQuotes.length;
    return motivationQuotes[index];
  }, [currentDay, motivationQuotes.length]);

  // Streak'e özel mesaj varsa göster
  const streakMessage = streakMessages[streak];

  // Tamamlanma yüzdesine göre özel mesajlar
  const progressMessage = useMemo(() => {
    const percent = (completedDays.length / 30) * 100;

    if (percent === 0) {
      return { text: "Haydi başla! Kendine inanıyoruz!", color: "#6366f1" };
    } else if (percent < 25) {
      return { text: "Harika bir başlangıç yaptın! Devam et!", color: "#3b82f6" };
    } else if (percent < 50) {
      return { text: "Çeyreği geçtin! Momentum'u koru!", color: "#8b5cf6" };
    } else if (percent < 75) {
      return { text: "Yarıdan fazlasını tamamladın! İnanılmazsın!", color: "#ec4899" };
    } else if (percent < 100) {
      return { text: "Son düzlük! Şampiyonluğa çok yakınsın!", color: "#f59e0b" };
    } else {
      return { text: "30 günü tamamladın! SEN BİR LEJENDSİN! 🎉", color: "#22c55e" };
    }
  }, [completedDays.length]);

  return (
    <div className="daily-motivation">
      {/* Streak Mesajı (varsa) */}
      {streakMessage && (
        <div className="motivation-streak">
          <span className="streak-emoji">{streakMessage.emoji}</span>
          <p className="streak-message">{streakMessage.message}</p>
        </div>
      )}

      {/* Günlük Alıntı */}
      <div className="motivation-quote">
        <span className="quote-emoji">{dailyQuote.emoji}</span>
        <blockquote>
          <p className="quote-text">"{dailyQuote.message}"</p>
          <footer className="quote-author">— {dailyQuote.author}</footer>
        </blockquote>
      </div>

      {/* İlerleme Mesajı */}
      <div className="motivation-progress" style={{ borderLeftColor: progressMessage.color }}>
        <p style={{ color: progressMessage.color }}>{progressMessage.text}</p>
      </div>

      {/* Mini İstatistikler */}
      <div className="motivation-stats">
        <div className="mini-stat">
          <span className="stat-icon">📅</span>
          <span className="stat-text">Gün {currentDay}/30</span>
        </div>
        <div className="mini-stat">
          <span className="stat-icon">✅</span>
          <span className="stat-text">{completedDays.length} tamamlandı</span>
        </div>
        <div className="mini-stat">
          <span className="stat-icon">🔥</span>
          <span className="stat-text">{streak} gün streak</span>
        </div>
      </div>
    </div>
  );
}

export default DailyMotivation;
