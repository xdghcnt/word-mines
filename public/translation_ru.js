window.t = (eng) => {
    const translations = {
        'Spectators': 'Наблюдают',
        'Enter': 'Войти',
        'Not enough players (minimum 3)': 'Слишком мало игроков (минимум 4)',
        'Host can start game': 'Хост может начать игру',
        'Wait for players to write their hints': 'Подождите, пока игроки напишут «слова-мины»',
        'Write your hint': 'Напишите «слово-мину»!',
        'Wait for players to delete duplicates': 'Загадайте слово не наступая на мины',
        'Delete duplicates': 'Следите, чтобы никто не наступил на мину',
        'Now try guess the original word': 'Теперь попробуйте угадать исходное слово',
        'Now ': 'Теперь ',
        ' should guess original word': ' должен угадать исходное слово',
        'Next round': 'Следующий раунд',
        'The winner is': 'Победил',
        'Ready': 'Готов',
        'Not ready': 'Не готов',
        'player time': 'Время на мину',
        'team time': 'Время на игру',
        'master time': 'Время на отгадывание',
        'reveal time': 'Время на лайк',
        'words level': 'Уровень слов',
        'goal': 'Очки для победы',
        'empty': 'Пусто'
    };

    if (translations.hasOwnProperty(eng)) {
        return translations[eng];
    } else {
        return eng;
    }
}