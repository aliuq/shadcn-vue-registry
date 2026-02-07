import type { BaseCollector } from './baseCollector'
import { ComponentCollector } from './componentCollector'
import { ExampleCollector } from './exampleCollector'
import { FileCollector } from './fileCollector'
import { HookCollector } from './hookCollector'
import { LibCollector } from './libCollector'
import { PageCollector } from './pageCollector'
import { StyleCollector } from './styleCollector'
import { ThemeCollector } from './themeCollector'
import { UiCollector } from './uiCollector'

/**
 * Default set of collectors that the registry builder uses.
 *
 * To add a new registry type:
 *  1. Create a new collector extending `BaseCollector`
 *  2. Add it to this array
 *
 * The order determines the iteration order during generation — it
 * does NOT affect the output.
 */
export function createDefaultCollectors(): BaseCollector[] {
  return [
    new ComponentCollector(),
    new HookCollector(),
    new ExampleCollector(),
    new LibCollector(),
    new UiCollector(),
    new PageCollector(),
    new FileCollector(),
    new StyleCollector(),
    new ThemeCollector(),
  ]
}
