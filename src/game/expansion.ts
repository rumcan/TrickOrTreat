import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import * as storage from './storage';
import { createExpansionStore } from './expansion-store';

export const FULL_GAME_ITEM = 'hide-and-shriek-full-game';
export const FULL_GAME_ENTITLEMENT = 'hide-and-shriek-full-game';
const PURCHASE_KEY = 'tot_fullgame_purchase_v1';
function timed<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RUN connection timed out. Please restore your unlock.')), 15000);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
export const expansion = createExpansionStore({
  quantity: () => timed(RundotGameAPI.entitlements.getQuantity(FULL_GAME_ENTITLEMENT)),
  async price() {
    const item = await timed(RundotGameAPI.shop.getItemDetail(FULL_GAME_ITEM));
    if (!item.active) return null;
    const price = item.resolvedPrice.finalPrice;
    return price.type === 'bucks' ? Number(price.value) : null;
  },
  buy: key => RundotGameAPI.shop.purchase(FULL_GAME_ITEM, key),
  getKey: () => storage.getItem(PURCHASE_KEY),
  setKey: key => storage.setItem(PURCHASE_KEY, key),
  uuid: () => crypto.randomUUID(),
}, import.meta.env.DEV);
export const hasFullGame = expansion.hasAccess;
