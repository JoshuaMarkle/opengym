import type { AmountUnit, Food, FoodEntry, FoodServing, FoodSettings, FoodTarget, MealId, SavedMeal } from '../db/types';
import { foodDayKey, lifterSplit, pickServing, shiftDay, dayNoon, totalsFor, type Nutrients } from './nutrition';

/**
 * Sample food logs for testing mode (nutrition-plan Phase 10): four weeks of meals for a
 * 190 lb lifter on 2,700 kcal, built from real USDA values. It includes an over-target day
 * (yesterday), an empty day, a day logged ahead (tomorrow), a packaged food with almost no
 * micronutrients (for "Fill in missing nutrients") and four saved meals. Today matches the
 * board (design/proposals/nutrition.html A2): breakfast, lunch and snacks logged, dinner empty.
 */

type SampleFood = { fdcId?: number; name: string; detail?: string | null; brand?: string; source?: Food['source']; barcode?: string; per100: Nutrients; servings: [string, number][]; favorite?: boolean };

const USDA = {
  yogurt: { fdcId: 170903, name: "Greek yogurt, 2%", detail: "Yogurt, Greek, plain, lowfat", per100: {"kcal":73,"alcohol":0,"caffeine":0,"c":3.94,"fiber":0,"starch":0,"sugars":3.56,"f":1.92,"sat":1.23,"mono":0.486,"poly":0.076,"trans":0.06,"omega3":0.007,"omega6":0.05,"cholesterol":10,"p":9.95,"vitA":90,"b1":0.044,"b2":0.233,"b3":0.197,"b5":0.47,"b6":0.055,"b12":0.52,"folate":12,"vitC":0.8,"vitD":0,"vitE":0.04,"vitK":0.2,"choline":15.2,"calcium":115,"copper":0.021,"iron":0.04,"magnesium":11,"manganese":0.007,"phosphorus":137,"potassium":141,"selenium":12.4,"sodium":34,"zinc":0.6}, servings: [["1 container (7 oz)", 200]] },
  oats: { fdcId: 173904, name: "Rolled oats, dry", detail: "Cereals, oats, regular and quick, not fortified, dry", per100: {"kcal":379,"alcohol":0,"caffeine":0,"c":67.7,"fiber":10.1,"starch":57.9,"sugars":0.99,"f":6.52,"sat":1.11,"mono":1.98,"poly":2.3,"omega3":0.1,"omega6":2.2,"cholesterol":0,"p":13.2,"vitA":0,"b1":0.46,"b2":0.155,"b3":1.13,"b5":1.12,"b6":0.1,"b12":0,"folate":32,"vitC":0,"vitD":0,"vitE":0.42,"vitK":2,"choline":40.4,"calcium":52,"copper":0.391,"iron":4.25,"magnesium":138,"manganese":3.63,"phosphorus":410,"potassium":362,"selenium":28.9,"sodium":6,"zinc":3.64}, servings: [["1 cup", 81], ["0.33 cup", 27]] },
  pb: { fdcId: 174266, name: "Peanut butter", detail: "Peanut butter, smooth style, with salt (Includes foods for USDA's Food Distribution Program)", per100: {"kcal":589,"alcohol":0,"caffeine":0,"c":22.7,"fiber":6.32,"starch":3.56,"sugars":10.5,"f":49.4,"sat":8.41,"mono":30.7,"poly":9.78,"trans":0.075,"omega3":0.027,"omega6":9.73,"cholesterol":0,"p":24,"vitA":0,"b1":0.121,"b2":0.192,"b3":17.2,"b5":1.14,"b6":0.381,"b12":0,"folate":87,"vitC":0,"vitD":0,"vitE":5.41,"vitK":0.3,"choline":63,"calcium":49.9,"copper":0.54,"iron":1.85,"magnesium":193,"manganese":1.68,"phosphorus":393,"potassium":654,"selenium":20.2,"sodium":221,"zinc":3.06}, servings: [["2 tbsp", 32], ["1 cup", 258]] },
  blueberries: { fdcId: 171711, name: "Blueberries", detail: "Blueberries, raw", per100: {"kcal":57.4,"alcohol":0,"caffeine":0,"c":14.6,"fiber":2.4,"starch":0.03,"sugars":9.96,"f":0.306,"sat":0.028,"mono":0.047,"poly":0.146,"trans":0,"omega3":0.058,"omega6":0.088,"cholesterol":0,"p":0.703,"vitA":3,"b1":0.037,"b2":0.041,"b3":0.418,"b5":0.124,"b6":0.052,"b12":0,"folate":6,"vitC":8.06,"vitD":0,"vitE":0.57,"vitK":19.3,"choline":6,"calcium":11.7,"copper":0.0461,"iron":0.34,"magnesium":6.18,"manganese":0.423,"phosphorus":13,"potassium":85.6,"selenium":0.1,"sodium":1,"zinc":0.0853}, servings: [["1 cup", 148], ["50 berries", 68]] },
  chicken: { fdcId: 2705968, name: "Chicken breast, grilled", detail: "Chicken breast, grilled without sauce, skin not eaten", per100: {"kcal":176,"alcohol":0,"caffeine":0,"c":0,"fiber":0,"sugars":0,"f":5.45,"sat":1.01,"mono":1.75,"poly":1.33,"omega3":0.121,"omega6":1.16,"cholesterol":96,"p":29.6,"vitA":9,"b1":0.086,"b2":0.21,"b3":10.1,"b6":0.855,"b12":0.18,"folate":7,"vitC":0,"vitD":0,"vitE":1.12,"vitK":2,"choline":75.7,"calcium":7,"copper":0.046,"iron":0.44,"magnesium":28,"phosphorus":224,"potassium":352,"selenium":30,"sodium":353,"zinc":0.9}, servings: [["1 cup, cooked, diced", 135], ["1 small breast", 105], ["1 medium breast", 120], ["1 large breast", 135], ["1 small or thin slice", 30], ["1 medium slice", 60]] },
  rice: { fdcId: 168878, name: "White rice, cooked", detail: "Rice, white, long-grain, regular, enriched, cooked", per100: {"kcal":130,"alcohol":0,"caffeine":0,"c":28.2,"fiber":0.4,"sugars":0.05,"f":0.28,"sat":0.077,"mono":0.088,"poly":0.076,"omega3":0.013,"omega6":0.062,"cholesterol":0,"p":2.69,"vitA":0,"b1":0.163,"b2":0.013,"b3":1.48,"b5":0.39,"b6":0.093,"b12":0,"folate":97,"vitC":0,"vitD":0,"vitE":0.04,"vitK":0,"choline":2.1,"calcium":10,"copper":0.069,"iron":1.2,"magnesium":12,"manganese":0.472,"phosphorus":43,"potassium":35,"selenium":7.5,"sodium":1,"zinc":0.49}, servings: [["1 cup", 158]] },
  broccoli: { fdcId: 169967, name: "Broccoli, steamed", detail: "Broccoli, cooked, boiled, drained, without salt", per100: {"kcal":35,"alcohol":0,"caffeine":0,"c":7.18,"fiber":3.3,"starch":0,"sugars":1.39,"f":0.41,"sat":0.079,"mono":0.04,"poly":0.17,"trans":0,"omega3":0.119,"omega6":0.051,"cholesterol":0,"p":2.38,"vitA":77,"b1":0.063,"b2":0.123,"b3":0.553,"b5":0.616,"b6":0.2,"b12":0,"folate":108,"vitC":64.9,"vitD":0,"vitE":1.45,"vitK":141,"choline":40.1,"calcium":40,"copper":0.061,"iron":0.67,"magnesium":21,"manganese":0.194,"phosphorus":67,"potassium":293,"selenium":1.6,"sodium":41,"zinc":0.45}, servings: [["0.5 cup, chopped", 78], ["1 stalk, large (11\"-12\" long)", 280], ["1 stalk, medium (7-1/2\" - 8\" long)", 180], ["1 stalk, small (5\" long)", 140], ["1 spear (about 5\" long)", 37]] },
  banana: { fdcId: 173944, name: "Banana", detail: "Bananas, raw", per100: {"kcal":97,"alcohol":0,"caffeine":0,"c":23,"fiber":1.7,"starch":3.66,"sugars":12.2,"f":0.29,"sat":0.112,"mono":0.032,"poly":0.073,"trans":0,"omega3":0.027,"omega6":0.046,"cholesterol":0,"p":0.74,"vitA":1,"b1":0.056,"b2":0.073,"b3":0.662,"b5":0.334,"b6":0.209,"b12":0,"folate":20,"vitC":12.3,"vitD":0,"vitE":0.1,"vitK":0.1,"choline":9.8,"calcium":5,"copper":0.101,"iron":0.26,"magnesium":28,"manganese":0.258,"phosphorus":22,"potassium":326,"selenium":1,"sodium":1,"zinc":0.16}, servings: [["1 cup, mashed", 225], ["1 cup, sliced", 150], ["1 extra small (less than 6\" long)", 81], ["1 small (6\" to 6-7/8\" long)", 101], ["1 medium (7\" to 7-7/8\" long)", 118], ["1 large (8\" to 8-7/8\" long)", 136]] },
  salmon: { fdcId: 175168, name: "Salmon, Atlantic farmed, cooked", detail: "Fish, salmon, Atlantic, farmed, cooked, dry heat", per100: {"kcal":206,"alcohol":0,"caffeine":0,"c":0,"fiber":0,"sugars":0,"f":12.3,"sat":2.4,"mono":4.18,"poly":4.55,"omega3":2.43,"omega6":1.94,"cholesterol":63,"p":22.1,"vitA":69,"b1":0.34,"b2":0.135,"b3":8.04,"b5":1.48,"b6":0.647,"b12":2.8,"folate":34,"vitC":3.7,"vitD":13.1,"vitE":1.14,"vitK":0.1,"choline":90.5,"calcium":15,"copper":0.049,"iron":0.34,"magnesium":30,"manganese":0.016,"phosphorus":252,"potassium":384,"selenium":41.4,"sodium":61,"zinc":0.43}, servings: [["3 oz", 85], ["0.5 fillet", 178]] },
  sweetPotato: { fdcId: 168483, name: "Sweet potato, baked", detail: "Sweet potato, cooked, baked in skin, flesh, without salt", per100: {"kcal":90,"alcohol":0,"caffeine":0,"c":20.7,"fiber":3.3,"starch":7.05,"sugars":6.48,"f":0.15,"sat":0.052,"mono":0.002,"poly":0.092,"trans":0,"omega3":0.006,"omega6":0.09,"cholesterol":0,"p":2.01,"vitA":961,"b1":0.107,"b2":0.106,"b3":1.49,"b5":0.884,"b6":0.286,"b12":0,"folate":6,"vitC":19.6,"vitD":0,"vitE":0.71,"vitK":2.3,"choline":13.1,"calcium":38,"copper":0.161,"iron":0.69,"magnesium":27,"manganese":0.497,"phosphorus":54,"potassium":475,"selenium":0.2,"sodium":36,"zinc":0.32}, servings: [["1 cup", 200], ["1 large", 180], ["1 medium (2\" dia, 5\" long, raw)", 114], ["1 small", 60]] },
  milk: { fdcId: 171265, name: "Milk, whole", detail: "Milk, whole, 3.25% milkfat, with added vitamin D", per100: {"kcal":60,"alcohol":0,"caffeine":0,"c":4.63,"fiber":0,"sugars":5.05,"f":3.2,"sat":1.86,"mono":0.688,"poly":0.108,"trans":0.112,"omega3":0.015,"omega6":0.088,"cholesterol":12,"p":3.27,"vitA":32,"b1":0.056,"b2":0.138,"b3":0.105,"b5":0.362,"b6":0.061,"b12":0.54,"folate":5,"vitC":0,"vitD":0.96,"vitE":0.05,"vitK":0.3,"choline":17.8,"calcium":123,"copper":0.001,"iron":0.03,"magnesium":11.9,"manganese":0.004,"phosphorus":101,"potassium":150,"selenium":1.9,"sodium":38,"zinc":0.42}, servings: [["1 cup", 244], ["1 fl oz", 30.5], ["1 tbsp", 15], ["1 quart", 976]] },
  eggs: { fdcId: 172187, name: "Eggs, scrambled", detail: "Egg, whole, cooked, scrambled", per100: {"kcal":149,"alcohol":0,"caffeine":0,"c":1.61,"fiber":0,"sugars":1.39,"f":11,"sat":3.33,"mono":4.44,"poly":2.43,"trans":0.624,"omega3":0.182,"omega6":2.21,"cholesterol":277,"p":9.99,"vitA":161,"b1":0.04,"b2":0.376,"b3":0.076,"b5":1.22,"b6":0.134,"b12":0.76,"folate":36,"vitC":0,"vitD":1.8,"vitE":1.15,"vitK":4,"choline":221,"calcium":66,"copper":0.059,"iron":1.31,"magnesium":11,"manganese":0.022,"phosphorus":165,"potassium":132,"selenium":23.5,"sodium":145,"zinc":1.04}, servings: [["1 large", 61], ["1 tbsp", 13.7], ["1 cup", 220]] },
  beef: { fdcId: 171794, name: "Ground beef 90/10, cooked", detail: "Beef, ground, 90% lean meat / 10% fat, crumbles, cooked, pan-browned", per100: {"kcal":230,"alcohol":0,"caffeine":0,"c":0,"fiber":0,"sugars":0,"f":12,"sat":4.71,"mono":5.03,"poly":0.428,"trans":0.359,"omega3":0.009,"omega6":0.369,"cholesterol":89,"p":28.4,"vitA":3,"b1":0.043,"b2":0.191,"b3":6.8,"b5":0.807,"b6":0.428,"b12":2.8,"folate":8,"vitC":0,"vitD":0,"vitE":0.12,"vitK":1.2,"choline":91.4,"calcium":16,"copper":0.099,"iron":3.08,"magnesium":27,"manganese":0.013,"phosphorus":250,"potassium":433,"selenium":21.6,"sodium":87,"zinc":6.84}, servings: [["3 oz", 85], ["1 portion ( yield from 1/2 lb raw meat )", 154]] },
  pasta: { fdcId: 169737, name: "Pasta, cooked", detail: "Pasta, cooked, enriched, without added salt", per100: {"kcal":158,"alcohol":0,"caffeine":0,"c":30.9,"fiber":1.8,"starch":26,"sugars":0.56,"f":0.93,"sat":0.176,"mono":0.131,"poly":0.326,"trans":0,"omega3":0.024,"omega6":0.295,"cholesterol":0,"p":5.8,"vitA":0,"b1":0.274,"b2":0.136,"b3":1.69,"b5":0.112,"b6":0.049,"b12":0,"folate":119,"vitC":0,"vitD":0,"vitE":0.06,"vitK":0,"choline":6.4,"calcium":7,"copper":0.1,"iron":1.28,"magnesium":18,"manganese":0.322,"phosphorus":58,"potassium":44,"selenium":26.4,"sodium":1,"zinc":0.51}, servings: [["1 cup spaghetti not packed", 124], ["1 cup spaghetti packed", 151], ["1 cup elbows not packed", 120], ["1 cup elbows packed", 132], ["1 cup penne", 107], ["1 cup farfalle", 107]] },
  marinara: { fdcId: 171192, name: "Marinara sauce", detail: "Sauce, pasta, spaghetti/marinara, ready-to-serve", per100: {"kcal":45,"alcohol":0,"caffeine":0,"c":8.05,"fiber":1.8,"starch":0,"sugars":4.91,"f":1.48,"sat":0.17,"mono":0.376,"poly":0.504,"trans":0.005,"omega3":0.079,"omega6":0.424,"cholesterol":2,"p":1.41,"vitA":32,"b1":0.024,"b2":0.061,"b3":3.92,"b5":0.076,"b6":0.173,"b12":0,"folate":13,"vitC":2,"vitD":0,"vitE":2.4,"vitK":13.9,"choline":13.7,"calcium":27,"copper":0.081,"iron":0.78,"magnesium":18.5,"manganese":0.137,"phosphorus":34,"potassium":319,"selenium":1.4,"sodium":419,"zinc":0.2}, servings: [["1 serving 1/2 cup", 132]] },
  apple: { fdcId: 171688, name: "Apple", detail: "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)", per100: {"kcal":52,"alcohol":0,"caffeine":0,"c":13.8,"fiber":2.4,"starch":0.05,"sugars":10.4,"f":0.17,"sat":0.028,"mono":0.007,"poly":0.051,"trans":0,"omega3":0.009,"omega6":0.043,"cholesterol":0,"p":0.26,"vitA":3,"b1":0.017,"b2":0.026,"b3":0.091,"b5":0.061,"b6":0.041,"b12":0,"folate":3,"vitC":4.6,"vitD":0,"vitE":0.18,"vitK":2.2,"choline":3.4,"calcium":6,"copper":0.027,"iron":0.12,"magnesium":5,"manganese":0.035,"phosphorus":11,"potassium":107,"selenium":0,"sodium":1,"zinc":0.04}, servings: [["1 cup, quartered or chopped", 125], ["1 cup slices", 109], ["1 large (3-1/4\" dia)", 223], ["1 medium (3\" dia)", 182], ["1 small (2-3/4\" dia)", 149], ["1 extra small (2-1/2\" dia)", 101]] },
  almonds: { fdcId: 170567, name: "Almonds", detail: "Nuts, almonds", per100: {"kcal":584,"alcohol":0,"caffeine":0,"c":20,"fiber":10.8,"starch":0.72,"sugars":4.35,"f":51.1,"sat":3.79,"mono":31.3,"poly":11.2,"trans":0.015,"omega3":0.003,"omega6":12.3,"cholesterol":0,"p":21.5,"vitA":0,"b1":0.161,"b2":1.14,"b3":3.77,"b5":0.471,"b6":0.101,"b12":0,"folate":44,"vitC":0,"vitD":0,"vitE":25.6,"vitK":0,"choline":52.1,"calcium":254,"copper":0.91,"iron":3.74,"magnesium":258,"manganese":2.15,"phosphorus":503,"potassium":733,"selenium":4.1,"sodium":1,"zinc":2.87}, servings: [["1 cup, whole", 143], ["1 cup, sliced", 92], ["1 cup, slivered", 108], ["1 cup, ground", 95], ["1 oz (23 whole kernels)", 28.4], ["1 almond", 1.2]] },
  oliveOil: { fdcId: 171413, name: "Olive oil", detail: "Oil, olive, salad or cooking", per100: {"kcal":884,"alcohol":0,"caffeine":0,"c":0,"fiber":0,"sugars":0,"f":100,"sat":13.8,"mono":73,"poly":10.5,"omega3":0.761,"omega6":9.76,"cholesterol":0,"p":0,"vitA":0,"b1":0,"b2":0,"b3":0,"b5":0,"b6":0,"b12":0,"folate":0,"vitC":0,"vitD":0,"vitE":14.3,"vitK":60.2,"choline":0.3,"calcium":1,"copper":0,"iron":0.56,"magnesium":0,"manganese":0,"phosphorus":0,"potassium":1,"selenium":0,"sodium":2,"zinc":0}, servings: [["1 tablespoon", 13.5], ["1 cup", 216], ["1 tsp", 4.5]] },
  tortilla: { fdcId: 175037, name: "Flour tortilla", detail: "Tortillas, ready-to-bake or -fry, flour, refrigerated", per100: {"kcal":306,"alcohol":0,"caffeine":0,"c":49.4,"fiber":3.5,"starch":38.4,"sugars":3.71,"f":7.99,"sat":2.92,"mono":1.75,"poly":2.29,"trans":0.052,"omega3":0.214,"omega6":2.04,"cholesterol":0,"p":8.2,"vitA":0,"b1":0.503,"b2":0.282,"b3":4.42,"b5":0.562,"b6":0.059,"b12":0,"folate":149,"vitC":0,"vitD":0,"vitE":0,"vitK":7.2,"choline":7.9,"calcium":146,"copper":0.104,"iron":3.63,"magnesium":22,"manganese":0.538,"phosphorus":206,"potassium":125,"selenium":22.3,"sodium":736,"zinc":0.53}, servings: [["1 tortilla", 48], ["1 oz", 28.4], ["1 tortilla medium (approx 6\" dia)", 30], ["1 package", 407], ["1 tortilla (approx 10\" dia)", 72], ["1 tortilla (approx 12\" dia)", 117]] },
  cheddar: { fdcId: 2705709, name: "Cheddar cheese", detail: "Cheese, Cheddar", per100: {"kcal":409,"alcohol":0,"caffeine":0,"c":2.44,"fiber":0,"sugars":0.33,"f":34,"sat":19.2,"mono":7.44,"poly":1.18,"omega3":0.15,"omega6":1.21,"cholesterol":100,"p":23.3,"vitA":316,"b1":0.029,"b2":0.441,"b3":0.052,"b6":0.069,"b12":1.06,"folate":21,"vitC":0,"vitD":0.6,"vitE":0.75,"vitK":2.4,"choline":16.5,"calcium":707,"copper":0.033,"iron":0.16,"magnesium":27,"phosphorus":458,"potassium":77,"selenium":28.3,"sodium":654,"zinc":3.67}, servings: [["1 cracker-size slice", 9], ["1 slice", 21], ["1 stick", 28.4], ["1 cup, shredded", 113], ["1 cup, diced", 132], ["1 cup, melted", 244]] },
  spinach: { fdcId: 168462, name: "Spinach, raw", detail: null, per100: {"kcal":21.6,"alcohol":0,"caffeine":0,"c":2.64,"fiber":1.59,"sugars":0.42,"f":0.604,"sat":0.063,"mono":0.01,"poly":0.165,"trans":0,"omega3":0.138,"omega6":0.026,"cholesterol":0,"p":2.91,"vitA":306,"b1":0.0765,"b2":0.192,"b3":0.51,"b5":0.065,"b6":0.214,"b12":0,"folate":194,"vitC":30.3,"vitD":0,"vitE":2.03,"vitK":483,"choline":19.3,"calcium":66.6,"copper":0.0788,"iron":1.05,"magnesium":93,"manganese":0.426,"phosphorus":40.6,"potassium":460,"selenium":1,"sodium":107,"zinc":0.423}, servings: [["1 cup", 30], ["1 bunch", 340], ["1 leaf", 10], ["1 package (10 oz)", 284]] },
  avocado: { fdcId: 171705, name: "Avocado", detail: "Avocados, raw, all commercial varieties", per100: {"kcal":160,"alcohol":0,"caffeine":0,"c":8.53,"fiber":6.7,"starch":0.11,"sugars":0.66,"f":14.7,"sat":2.13,"mono":9.8,"poly":1.82,"trans":0,"omega3":0.111,"omega6":1.67,"cholesterol":0,"p":2,"vitA":7,"b1":0.067,"b2":0.13,"b3":1.74,"b5":1.39,"b6":0.257,"b12":0,"folate":81,"vitC":10,"vitD":0,"vitE":2.07,"vitK":21,"choline":14.2,"calcium":12,"copper":0.19,"iron":0.55,"magnesium":29,"manganese":0.142,"phosphorus":52,"potassium":485,"selenium":0.4,"sodium":7,"zinc":0.64}, servings: [["1 cup, cubes", 150], ["1 cup, pureed", 230], ["1 cup, sliced", 146], ["1 avocado, NS as to Florida or California", 201], ["1 NLEA Serving", 50]] },
  bread: { fdcId: 172688, name: "Whole wheat bread", detail: "Bread, whole-wheat, commercially prepared", per100: {"kcal":254,"alcohol":0,"caffeine":0,"c":43.1,"fiber":6,"starch":28.7,"sugars":4.34,"f":3.55,"sat":0.732,"mono":0.616,"poly":1.61,"trans":0.022,"omega3":0.139,"omega6":1.46,"cholesterol":0,"p":12.3,"vitA":0,"b1":0.391,"b2":0.166,"b3":4.43,"b5":0.65,"b6":0.216,"b12":0,"folate":42,"vitC":0,"vitD":0,"vitE":2.82,"vitK":7.8,"choline":27.2,"calcium":163,"copper":0.226,"iron":2.56,"magnesium":76.6,"manganese":2.18,"phosphorus":212,"potassium":250,"selenium":25.8,"sodium":450,"zinc":1.76}, servings: [["1 slice", 32], ["1 oz", 28.4]] },
  strawberries: { fdcId: 167762, name: "Strawberries", detail: "Strawberries, raw", per100: {"kcal":32.7,"alcohol":0,"caffeine":0,"c":7.96,"fiber":2,"starch":0.04,"sugars":4.89,"f":0.22,"sat":0.015,"mono":0.043,"poly":0.155,"trans":0,"omega3":0.065,"omega6":0.09,"cholesterol":0,"p":0.641,"vitA":1,"b1":0.024,"b2":0.022,"b3":0.386,"b5":0.125,"b6":0.047,"b12":0,"folate":24,"vitC":59.6,"vitD":0,"vitE":0.29,"vitK":2.2,"choline":5.7,"calcium":16.9,"copper":0.0347,"iron":0.255,"magnesium":12.5,"manganese":0.367,"phosphorus":23,"potassium":161,"selenium":0.4,"sodium":1,"zinc":0.114}, servings: [["1 cup, halves", 152], ["1 cup, pureed", 232], ["1 cup, sliced", 166], ["1 cup, whole", 144], ["1 extra large (1-5/8\" dia)", 27], ["1 large (1-3/8\" dia)", 18]] },
  coffee: { fdcId: 171890, name: "Coffee", detail: "Beverages, coffee, brewed, prepared with tap water", per100: {"kcal":1,"alcohol":0,"caffeine":40,"c":0,"fiber":0,"sugars":0,"f":0.02,"sat":0.002,"mono":0.015,"poly":0.001,"trans":0,"omega3":0,"omega6":0.001,"cholesterol":0,"p":0.12,"vitA":0,"b1":0.014,"b2":0.076,"b3":0.191,"b5":0.254,"b6":0.001,"b12":0,"folate":2,"vitC":0,"vitD":0,"vitE":0.01,"vitK":0.1,"choline":2.6,"calcium":2,"copper":0.002,"iron":0.01,"magnesium":3,"manganese":0.023,"phosphorus":3,"potassium":49,"selenium":0,"sodium":2,"zinc":0.02}, servings: [["1 fl oz", 29.6], ["6 fl oz", 178], ["1 cup (8 fl oz)", 237]] },
  beans: { fdcId: 173735, name: "Black beans, cooked", detail: "Beans, black, mature seeds, cooked, boiled, without salt", per100: {"kcal":132,"alcohol":0,"caffeine":0,"c":23.7,"fiber":8.7,"sugars":0.32,"f":0.54,"sat":0.139,"mono":0.047,"poly":0.231,"trans":0,"omega3":0.105,"omega6":0.126,"cholesterol":0,"p":8.86,"vitA":0,"b1":0.244,"b2":0.059,"b3":0.505,"b5":0.242,"b6":0.069,"b12":0,"folate":149,"vitC":0,"vitD":0,"vitE":0.87,"vitK":3.3,"choline":32.6,"calcium":27,"copper":0.209,"iron":2.1,"magnesium":70,"manganese":0.444,"phosphorus":140,"potassium":355,"selenium":1.2,"sodium":1,"zinc":1.12}, servings: [["1 cup", 172]] },
  cottage: { fdcId: 172182, name: "Cottage cheese, 2%", detail: "Cheese, cottage, lowfat, 2% milkfat", per100: {"kcal":84,"alcohol":0,"caffeine":0,"c":4.31,"fiber":0,"sugars":4,"f":2.3,"sat":1.26,"mono":0.469,"poly":0.072,"trans":0.069,"omega3":0.009,"omega6":0.051,"cholesterol":12,"p":11,"vitA":69,"b1":0.02,"b2":0.234,"b3":0.09,"b5":0.508,"b6":0.057,"b12":0.42,"folate":8,"vitC":0,"vitD":0,"vitE":0.08,"vitK":0,"choline":16.3,"calcium":103,"copper":0.03,"iron":0.13,"magnesium":8.9,"manganese":0.015,"phosphorus":148,"potassium":120,"selenium":14.6,"sodium":321,"zinc":0.61}, servings: [["4 oz", 113], ["1 cup (not packed)", 226]] },} satisfies Record<string, SampleFood>;

const OWN = {
  whey: { name: 'Whey shake', source: 'custom', per100: { kcal: 400, p: 80, c: 10, f: 6.7, sugars: 3.3, sat: 3.3, sodium: 433, calcium: 433, cholesterol: 100 }, servings: [['1 scoop', 30]], favorite: true },
  bar: {
    name: 'Protein bar, chocolate',
    brand: 'Crisp Co.',
    source: 'off',
    barcode: '0850012345671',
    per100: { kcal: 350, p: 33.3, c: 36.7, f: 11.7, fiber: 5, sugars: 3.3, sat: 5, sodium: 250 },
    servings: [['1 bar', 60]],
  },
} satisfies Record<string, SampleFood>;

const ALL: Record<string, SampleFood> = { ...USDA, ...OWN };
type Key = keyof typeof USDA | keyof typeof OWN;

const idOf = (k: Key) => {
  const f = ALL[k];
  return f.fdcId ? `usda-${f.fdcId}` : `sample-${k}`;
};

/** An item: grams, or a count of the food's default serving. */
type Item = [Key, number, 'g' | 'serv'];

const BREAKFAST: Item[][] = [
  [['yogurt', 245, 'g'], ['oats', 60, 'g'], ['pb', 1, 'serv'], ['blueberries', 75, 'g']],
  [['eggs', 2, 'serv'], ['bread', 2, 'serv'], ['banana', 1, 'serv'], ['coffee', 1, 'serv']],
  [['oats', 81, 'g'], ['whey', 1, 'serv'], ['milk', 1, 'serv'], ['strawberries', 150, 'g']],
];
const LUNCH: Item[][] = [
  [['chicken', 200, 'g'], ['rice', 1.5, 'serv'], ['broccoli', 150, 'g']],
  [['tortilla', 2, 'serv'], ['beef', 150, 'g'], ['cheddar', 28, 'g'], ['beans', 86, 'g'], ['avocado', 50, 'g']],
  [['pasta', 250, 'g'], ['marinara', 1, 'serv'], ['beef', 113, 'g']],
];
const DINNER: Item[][] = [
  [['salmon', 220, 'g'], ['sweetPotato', 250, 'g'], ['spinach', 60, 'g'], ['oliveOil', 1, 'serv']],
  [['chicken', 250, 'g'], ['pasta', 200, 'g'], ['oliveOil', 1, 'serv'], ['broccoli', 150, 'g']],
  [['beef', 200, 'g'], ['rice', 2, 'serv'], ['broccoli', 150, 'g']],
];
const SNACKS: Item[][] = [
  [['bar', 1, 'serv'], ['banana', 1, 'serv'], ['whey', 1.5, 'serv']],
  [['almonds', 28, 'g'], ['apple', 1, 'serv']],
  [['cottage', 226, 'g'], ['strawberries', 150, 'g']],
  [['whey', 1.5, 'serv']],
];

/** Seeded random (mulberry32), so every reset gives the same weeks. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleFoodData {
  foods: Food[];
  entries: FoodEntry[];
  savedMeals: SavedMeal[];
  targets: FoodTarget[];
  settings: FoodSettings;
}

const WEIGHT_LB = 190;
const KCAL = 2700;

export function generateSampleFood(opts: { now?: number; newId?: () => string } = {}): SampleFoodData {
  const now = opts.now ?? Date.now();
  let n = 0;
  const newId = opts.newId ?? (() => `sf-${++n}`);
  const today = foodDayKey(now);
  const rand = rng(11);
  const t0 = now - 40 * 86_400_000;

  const foods = new Map<Key, Food>();
  for (const k of Object.keys(ALL) as Key[]) {
    const f = ALL[k];
    const servings: FoodServing[] = f.servings.map(([label, grams]) => ({ label, grams }));
    foods.set(k, {
      id: idOf(k),
      createdAt: t0,
      updatedAt: t0,
      name: f.name,
      ...(f.detail ? { detail: f.detail } : {}),
      ...(f.brand ? { brand: f.brand } : {}),
      ...(f.barcode ? { barcode: f.barcode } : {}),
      source: f.source ?? 'usda',
      ...(f.fdcId ? { fdcId: f.fdcId } : {}),
      basis: 'g',
      per100: f.per100,
      servings,
      ...(servings.length ? { defaultServing: pickServing(servings, f.per100.kcal) } : {}),
      mine: true,
      ...(f.favorite || k === 'chicken' ? { favorite: true } : {}),
    });
  }

  const amount = (item: Item) => {
    const f = foods.get(item[0])!;
    if (item[2] === 'g') return { grams: item[1], unit: 'g' as AmountUnit };
    const i = f.defaultServing ?? 0;
    return { grams: Math.round(f.servings[i].grams * item[1] * 10) / 10, unit: 'serv' as AmountUnit, serving: i };
  };

  const entries: FoodEntry[] = [];
  const HOUR: Record<MealId, number> = { breakfast: 8, lunch: 12.5, dinner: 19, snacks: 15.5 };
  const log = (day: string, meal: MealId, items: Item[]) => {
    items.forEach((item, order) => {
      const f = foods.get(item[0])!;
      const a = amount(item);
      const at = dayNoon(day) + (HOUR[meal] - 12) * 3_600_000 + order * 60_000;
      entries.push({
        id: newId(),
        createdAt: at,
        updatedAt: at,
        day,
        meal,
        order,
        loggedAt: at,
        foodId: f.id,
        name: f.name,
        ...(f.brand ? { brand: f.brand } : {}),
        grams: a.grams,
        basis: f.basis,
        unit: a.unit,
        ...(a.serving != null ? { serving: a.serving } : {}),
        servings: f.servings,
        totals: totalsFor(f.per100, a.grams),
      });
      if (at <= now) f.last = a;
    });
  };
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];

  for (let d = -27; d <= -2; d++) {
    const day = shiftDay(today, d);
    // An empty day now and then: it doesn't count in averages and shows a grey ring.
    if (d === -5 || d === -16) continue;
    log(day, 'breakfast', pick(BREAKFAST));
    log(day, 'lunch', pick(LUNCH));
    log(day, 'dinner', pick(DINNER));
    if (rand() < 0.75) log(day, 'snacks', pick(SNACKS));
  }
  // Yesterday went over (A4): a big lunch and a big dinner.
  const yesterday = shiftDay(today, -1);
  log(yesterday, 'breakfast', BREAKFAST[1]);
  log(yesterday, 'lunch', LUNCH[1]);
  log(yesterday, 'dinner', DINNER[2]);
  log(yesterday, 'snacks', SNACKS[0]);
  // Today, as on the board: dinner still to come.
  log(today, 'breakfast', BREAKFAST[0]);
  log(today, 'lunch', LUNCH[0]);
  log(today, 'snacks', SNACKS[0]);
  // Logged ahead: tomorrow's breakfast.
  log(shiftDay(today, 1), 'breakfast', BREAKFAST[2]);

  const meal = (name: string, items: Item[], order: number): SavedMeal => ({
    id: newId(),
    createdAt: t0,
    updatedAt: t0,
    name,
    order,
    items: items.map((it) => ({ foodId: idOf(it[0]), ...amount(it) })),
  });
  const savedMeals = [
    meal('Post-workout shake', [['whey', 1.5, 'serv'], ['milk', 300, 'g'], ['banana', 1, 'serv'], ['pb', 8, 'g']], 0),
    meal('Usual breakfast', BREAKFAST[0], 1),
    meal('Chicken rice bowl', LUNCH[0], 2),
    meal('Pre-workout snack', [['banana', 1, 'serv'], ['almonds', 28, 'g']], 3),
  ];

  const split = lifterSplit(KCAL, WEIGHT_LB);
  const birthYear = new Date(now).getFullYear() - 29;
  const targets: FoodTarget[] = [
    { id: newId(), createdAt: t0, updatedAt: t0, from: shiftDay(today, -40), mode: 'target', kcal: KCAL, diet: 'lifter', pct: split.pct, grams: split.grams, sex: 'm', birthYear },
  ];

  return {
    foods: [...foods.values()],
    entries,
    savedMeals,
    targets,
    settings: { sex: 'm', birthYear, heightIn: 71, weightLb: WEIGHT_LB, activity: 3, goal: 'lose', paceLb: 0.5, goalWeightLb: 180, online: true, setUp: true },
  };
}
