// app/games/spot_diff.js

// 전역 함수로 노출 (index.html에서 이걸 호출해서 렌더링)
window.renderSpotDiffGame = function (container) {
  if (!container) return;

  container.innerHTML = `
    <div class="text-xs sm:text-sm text-slate-600 mb-2">
      <b>틀린 그림 찾기 게임</b><br/>
      왼쪽과 오른쪽 그림 중 <b>다른 곳</b>을 찾아 터치/클릭해보세요.
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <div class="text-center text-[11px] text-slate-500 mb-1">왼쪽</div>
        <div class="grid grid-cols-4 gap-2" data-role="left-grid"></div>
      </div>
      <div class="flex-1">
        <div class="text-center text-[11px] text-slate-500 mb-1">오른쪽</div>
        <div class="grid grid-cols-4 gap-2" data-role="right-grid"></div>
      </div>
    </div>
    <div data-role="status" class="mt-2 text-xs sm:text-sm text-amber-800 font-medium"></div>
  `;

  const level = {
    left:  [
      '🍎','🍌','🍇','🍊',
      '🍓','🍍','🥝','🍒',
      '🍉','🥕','🥦','🍋'
    ],
    right: [
      '🍎','🍌','🍇','🍊',
      '🍓','🍍','🥝','🍒',
      '🍉','🥕','🥦','🍐'  // 마지막 칸만 다름
    ],
    answers: [11] // 다른 칸 index
  };

  const leftGrid  = container.querySelector('[data-role="left-grid"]');
  const rightGrid = container.querySelector('[data-role="right-grid"]');
  const statusEl  = container.querySelector('[data-role="status"]');

  const totalDiff = level.answers.length;
  const found = new Set();

  function updateStatus() {
    const remain = totalDiff - found.size;
    if (remain <= 0) {
      statusEl.textContent = '모든 다른 그림을 찾았습니다! 잘하셨어요 👏';
    } else {
      statusEl.textContent = `다른 그림이 아직 ${remain}개 남아 있습니다.`;
    }
  }

  level.left.forEach((emoji) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className =
      'w-12 h-12 sm:w-14 sm:h-14 text-2xl sm:text-3xl flex items-center justify-center rounded-xl bg-white border border-amber-100 shadow-sm';
    cell.textContent = emoji;
    cell.setAttribute('aria-hidden', 'true');
    leftGrid.appendChild(cell);
  });

  level.right.forEach((emoji, idx) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className =
      'w-12 h-12 sm:w-14 sm:h-14 text-2xl sm:text-3xl flex items-center justify-center rounded-xl bg-white border border-amber-100 shadow-sm transition';
    cell.textContent = emoji;
    cell.dataset.index = String(idx);

    cell.addEventListener('click', () => {
      const i = parseInt(cell.dataset.index, 10);
      const isAnswer = level.answers.includes(i);

      if (!isAnswer) {
        cell.classList.add('ring-2', 'ring-red-300');
        setTimeout(() => {
          cell.classList.remove('ring-2', 'ring-red-300');
        }, 400);
        return;
      }

      if (found.has(i)) return;

      found.add(i);
      cell.classList.add('bg-amber-100', 'border-amber-400', 'scale-105');
      updateStatus();
    });

    rightGrid.appendChild(cell);
  });

  updateStatus();
};
