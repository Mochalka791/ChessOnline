const chessButtons = document.querySelectorAll('[data-game="chess"], #cta-chess');
for (const button of chessButtons) {
    button?.addEventListener('click', () => {
        window.location.href = '/chess/';
    });
}
