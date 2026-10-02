import { mockStore } from './mockStore'

export async function getPlayableGames() {
  return mockStore.games.filter(game => game.is_active && game.is_open)
}
