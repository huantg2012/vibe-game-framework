// Prepared actual Master checker; run only after this batch's formal author append.
process.argv.push('--batch=b12');
await import('../author-preparation/check-actual-body.mjs');
