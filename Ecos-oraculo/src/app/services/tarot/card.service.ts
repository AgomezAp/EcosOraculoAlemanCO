import { Injectable } from '@angular/core';
import { cardData } from '../../assets/data';

@Injectable({
  providedIn: 'root',
})
export class CardService {
  private storageKey = 'selectedCards';
  private themeKey = 'selectedTheme'; // ✅ NUEVO: clave para el tema

  getCardsByTheme(theme: string): any[] {
    return cardData
      .map((card: any) => {
        if (!card.descriptions[theme]) {
          return { ...card, descriptions: ['Descripción no disponible'] };
        }
        // Seleccionar una descripción aleatoria de las cuatro disponibles por tema
        const randomDescription =
          card.descriptions[theme][
            Math.floor(Math.random() * card.descriptions[theme].length)
          ];
        return {
          ...card,
          name: card.name,
          descriptions: [randomDescription],
        };
      })
      .sort(() => 0.5 - Math.random());
  }

  // ✅ NUEVO: Método para guardar el tema
  setTheme(theme: string): void {
    localStorage.setItem(this.themeKey, theme);
  }

  // ✅ NUEVO: Método para obtener el tema
  getTheme(): string | null {
    const theme = localStorage.getItem(this.themeKey);
    return theme;
  }

  setSelectedCards(cards: any[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(cards));
  }

  getSelectedCards(): any[] {
    const storedCards = localStorage.getItem(this.storageKey);
    const cards = storedCards ? JSON.parse(storedCards) : [];
    return cards;
  }

  clearSelectedCards(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.themeKey); // ✅ Limpiar tema también
  }
}
