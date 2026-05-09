document.addEventListener('DOMContentLoaded', () => {
  const feedbackForm = document.getElementById('feedback-form');
  const feedbackDisplay = document.getElementById('feedback-display');
  let successModalTimer = null;

  // Fetch and display feedbacks (approved / transferred / replied)
  async function loadFeedback() {
    try {
      const response = await fetch('/api/feedback');
      if (!response.ok) throw new Error('Failed to load feedback');
      const feedbacks = await response.json();

      feedbackDisplay.innerHTML = '';
      
      if (!feedbacks || feedbacks.length === 0) {
        feedbackDisplay.innerHTML = `
          <div class="state-box">
            <div class="state-title">暂无已审核内容</div>
            <div class="state-sub">已审核的反馈将显示在此</div>
          </div>
        `;
        return;
      }

      feedbacks.forEach(f => {
        const card = document.createElement('div');
        card.className = 'submission-card';
        
        const statusMap = {
          approved: '已审核',
          transferred: '转接中',
          replied: '已回复'
        };
        const statusLabel = statusMap[f.status] || f.status;
        const statusClass = `status-${f.status}`;
        
        const createdDate = new Date(f.createdAt).toLocaleString('zh-CN');
        
        let replyHtml = '';
        if (f.reply && f.reply.trim()) {
          replyHtml = `
            <div class="card-reply">
              <div class="card-reply-title">💬 管理员回复：</div>
              <div class="card-reply-content">${escapeHtml(f.reply)}</div>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="card-header">
            <span class="card-type-badge type-${escapeHtml(f.type)}">${escapeHtml(f.type)}</span>
            <span class="card-time">${createdDate}</span>
          </div>
          <div class="card-content">${escapeHtml(f.message)}</div>
          <div class="card-status">
            <span class="status-badge ${statusClass}">● ${statusLabel}</span>
          </div>
          ${replyHtml}
        `;
        feedbackDisplay.appendChild(card);
      });
    } catch (error) {
      console.error('Error loading feedback:', error);
      feedbackDisplay.innerHTML = `
        <div class="state-box">
          <div class="state-title">加载失败</div>
          <div class="state-sub">请稍后重试</div>
        </div>
      `;
    }
  }

  // Show success modal with auto-close
  function showSuccessModal() {
    const modal = document.getElementById('successModal');
    if (!modal) return;

    modal.classList.add('show');
    
    // Clear previous timer if exists
    if (successModalTimer) {
      clearTimeout(successModalTimer);
    }

    // Auto close after 3 seconds
    successModalTimer = setTimeout(() => {
      modal.classList.remove('show');
      successModalTimer = null;
    }, 3000);
  }

  // Submit feedback (send JSON)
  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const type = document.getElementById('category').value.trim();
    const message = document.getElementById('feedback-content').value.trim();
    
    if (!type) {
      showToast('请选择反馈类型', 'error');
      return;
    }
    if (!message) {
      showToast('请输入反馈内容', 'error');
      return;
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }
      
      // Show success modal
      showSuccessModal();
      
      // Reset form
      feedbackForm.reset();
      
      // Reload feedback list after a short delay
      setTimeout(() => {
        loadFeedback();
      }, 500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      showToast('提交失败: ' + error.message, 'error');
    }
  });

  // Show toast notification
  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show toast-${type}`;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
  }

  // Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Load feedback on page load
  loadFeedback();
});
