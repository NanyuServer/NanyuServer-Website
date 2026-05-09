document.addEventListener('DOMContentLoaded', () => {
  const feedbackForm = document.getElementById('feedback-form');
  const feedbackDisplay = document.getElementById('feedback-display');
  // frontend no longer provides reply UI; admin handles replies

  // Fetch and display feedbacks (approved / transferred / replied)
  async function loadFeedback() {
    const response = await fetch('/api/feedback');
    const feedbacks = await response.json();

    feedbackDisplay.innerHTML = '';
    feedbacks.forEach(f => {
      const li = document.createElement('li');
      li.className = 'submission-card';
      const statusMap = {
        approved: '已审核',
        transferred: '转接中',
        replied: '已答复'
      };
      const statusLabel = statusMap[f.status] || f.status;
      const badge = `<div style="margin-bottom:8px;">` +
        `<span class="type-badge" style="padding:6px 10px;border-radius:999px;background:rgba(13,8,24,0.45);border:1px solid rgba(123,85,212,0.18);">${escapeHtml(f.type)}</span>` +
        `<span style="float:right;color:#a8b0d6">${new Date(f.createdAt).toLocaleString()}</span>` +
        `</div>`;

      li.innerHTML = `
        <div class="card-header">${badge}</div>
        <div class="card-content">${escapeHtml(f.message)}</div>
        <div style="margin-top:10px;color:#a8b0d6;font-size:0.9rem">状态：<strong>${statusLabel}</strong></div>
        ${f.reply ? `<div style="margin-top:8px;padding:10px;border-left:3px solid rgba(96,165,250,0.25);background:rgba(96,165,250,0.03);">回复：${escapeHtml(f.reply)}</div>` : ''}
      `;
      feedbackDisplay.appendChild(li);
    });
  }

  // Submit feedback (send JSON)
  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('category').value;
    const message = document.getElementById('feedback-content').value.trim();
    if (!message) return alert('请输入反馈内容');

    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message })
    });
    feedbackForm.reset();
    loadFeedback();
  });

  // no front-end reply handling

  loadFeedback();
});

function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }