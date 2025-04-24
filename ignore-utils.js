/**
 * Convert a single .gitignore‑style glob pattern into a RegExp.
 *
 * Supported constructs ("straight‑forward" subset of gitignore):
 *   •  # comment : ignored before calling
 *   •  !pattern  : negation (handled by the caller)
 *   •  **        : any number of nested directories (including 0)
 *   •  *         : any sequence of characters except a slash
 *   •  ?         : exactly one character except a slash
 *   •  leading / : anchor to repo root
 *   •  trailing /: directory pattern – matches the directory and everything inside
 *
 * Edge‑cases that are deliberately NOT covered:   \ escaping,   **.ext,   [abc],
 * weird double‑bang rules, & other rarely used features. For most day‑to‑day
 * ignore files this subset is more than enough.
 */
export function globToRegex (glob) {
    // Track whether the pattern is anchored (starts with "/")
    const anchoredToRoot = glob.startsWith('/');
    if (anchoredToRoot) glob = glob.slice(1);
  
    // Track whether the pattern targets a directory (ends with "/")
    const isDirPattern = glob.endsWith('/');
    if (isDirPattern) glob = glob.slice(0, -1);
  
    // Escape regex metacharacters (except our globs * ? /)
    let rx = glob.replace(/([.+^$(){}|[\]\\])/g, '\\$1');
  
    // Replace "**" first – must consume both stars at once
    rx = rx.replace(/\*\*/g, '.*');
  
    // Replace remaining "*" and "?"
    rx = rx.replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
  
    // Add anchor: beginning of string OR a slash boundary
    rx = (anchoredToRoot ? '^' : '(^|/)') + rx;
  
    // Add ending based on directory vs file pattern
    rx += isDirPattern ? '(/.*|$)' : '($|/)';
  
    try {
      return new RegExp(rx);
    } catch (e) {
      console.warn(`Invalid glob pattern "${glob}":`, e);
      return null;
    }
  }
  
  /**
   * Parse a raw ignore file contents (one pattern per line) into a list of rules
   * that can be applied with `isIgnored(path, rules)`.
   */
  export function parseIgnoreFile (raw) {
    return raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#')) // drop comments & blank lines
      .map(l => {
        const negate = l.startsWith('!');
        const pattern = negate ? l.slice(1) : l;
        const regex = globToRegex(pattern);
        return regex ? { regex, negate } : null;
      })
      .filter(Boolean);
  }
  
  /**
   * Evaluate .gitignore logic: the last matching rule wins.
   */
  export function isIgnored (filePath, rules) {
    let ignore = false;
    for (const { regex, negate } of rules) {
      if (regex.test(filePath)) {
        ignore = !negate;
      }
    }
    return ignore;
  }
  