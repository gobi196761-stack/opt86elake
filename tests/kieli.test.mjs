import { test } from "node:test";
import assert from "node:assert/strict";
import { kaanna, valitseKieli } from "../lib/kieli.js";

test("kieli: oletus suomi, ?kieli=en englanti, tallennettu valinta muistetaan", () => {
  assert.equal(valitseKieli("", null), "fi");
  assert.equal(valitseKieli("?kieli=en", "fi"), "en");
  assert.equal(valitseKieli("?kieli=fi", "en"), "fi");
  assert.equal(valitseKieli("", "en"), "en");
  assert.equal(valitseKieli("?kieli=sv", null), "fi");
});

test("kaanna: englanti jää ennalleen", () => {
  assert.equal(kaanna("Log out", "en"), "Log out");
});

test("kaanna: kiinteät tekstit, välilyönnit säilyvät", () => {
  assert.equal(kaanna("Log out", "fi"), "Kirjaudu ulos");
  assert.equal(kaanna("\n   Don't have an account? ", "fi"), "\n   Eikö sinulla ole tiliä? ");
  assert.equal(kaanna("Tuntematon teksti", "fi"), "Tuntematon teksti");
});

test("kaanna: muuttujia sisältävät lauseet", () => {
  assert.equal(kaanna("Group A", "fi"), "Ryhmä A");
  assert.equal(kaanna("Group B chat", "fi"), "Ryhmä B – chat");
  assert.equal(kaanna("Signed in: Ukkola Jorma", "fi"), "Kirjautunut: Ukkola Jorma");
  assert.equal(kaanna("Monthly games - October results", "fi"), "Kuukausikisat - lokakuun tulokset");
  assert.equal(kaanna("OCTOBER 2026", "fi"), "LOKAKUU 2026");
  assert.equal(kaanna("Error: boom", "fi"), "Virhe: boom");
  assert.equal(kaanna("Updated ratings for 7 players!", "fi"), "Päivitettiin 7 pelaajan rating!");
  assert.equal(
    kaanna("Estimated rating change from 3 group matches (2 W, 1 L): +4.2 rating + 2 bonus. SPTL formula; the official rating is calculated by SPTL. 1 match(es) without a rating not counted.", "fi"),
    "Arvioitu rating-muutos 3 ryhmäottelusta (2 V, 1 H): +4.2 ratingia + 2 bonus. SPTL:n kaava; virallisen ratingin laskee SPTL. 1 ottelua ilman ratingia jätetty laskematta.");
  assert.equal(kaanna("Migration completed.\nDuplicate names, fix these in \"Manage users\": a, b", "fi"),
    "Tietojen siirto valmis.\nPäällekkäiset nimet, korjaa nämä kohdassa \"Hallitse käyttäjiä\": a, b");
});
