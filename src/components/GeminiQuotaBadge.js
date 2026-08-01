import React, { useState, useEffect } from 'react';
import { getQuotaStatus } from '../utils/geminiClient';
import './GeminiQuotaBadge.css';

const GeminiQuotaBadge = ({ retryStatus }) => {
  const [quota, setQuota] = useState(getQuotaStatus());

  useEffect(() => {
    const interval = setInterval(() => setQuota(getQuotaStatus()), 1000);
    return () => clearInterval(interval);
  }, []);

  const ratio = quota.used / quota.limit;
  const level = ratio >= 0.85 ? 'danger' : ratio >= 0.5 ? 'warning' : 'ok';

  return (
    <div className={`gemini-quota-badge ${level}`}>
      <span>🤖 Gemini: {quota.used}/{quota.limit} istek (bu dakika)</span>
      {retryStatus && (
        <span className="quota-retry-status">
          ⏳ Kota limiti — {Math.ceil(retryStatus.waitMs / 1000)}sn sonra otomatik tekrar deneniyor (deneme {retryStatus.attempt}/3)
        </span>
      )}
    </div>
  );
};

export default GeminiQuotaBadge;
