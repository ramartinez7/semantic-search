import { normalize, cosine, toFloat32Blob, fromFloat32Blob, isTextLike } from './utils';

function testNormalize() {
  console.log('Testing normalize...');
  const vec = [3, 4, 0];
  const normalized = normalize(vec);
  const expectedMagnitude = Math.sqrt(3*3 + 4*4); // 5
  const expected = [3/5, 4/5, 0];
  
  for (let i = 0; i < vec.length; i++) {
    if (Math.abs(normalized[i] - expected[i]) > 1e-10) {
      throw new Error(`Normalize failed at index ${i}: got ${normalized[i]}, expected ${expected[i]}`);
    }
  }
  console.log('✓ normalize works correctly');
}

function testCosine() {
  console.log('Testing cosine similarity...');
  const a = [1, 0, 0];
  const b = [0, 1, 0];
  const c = [1, 0, 0];
  
  if (Math.abs(cosine(a, b) - 0) > 1e-10) {
    throw new Error(`Cosine of orthogonal vectors should be 0, got ${cosine(a, b)}`);
  }
  
  if (Math.abs(cosine(a, c) - 1) > 1e-10) {
    throw new Error(`Cosine of identical vectors should be 1, got ${cosine(a, c)}`);
  }
  
  console.log('✓ cosine similarity works correctly');
}

function testBlobConversion() {
  console.log('Testing blob conversion...');
  const vec = [1.5, -2.3, 0.7, 42.1];
  const blob = toFloat32Blob(vec);
  const restored = fromFloat32Blob(blob);
  
  for (let i = 0; i < vec.length; i++) {
    if (Math.abs(restored[i] - vec[i]) > 1e-5) { // Float32 precision is lower
      throw new Error(`Blob conversion failed at index ${i}: got ${restored[i]}, expected ${vec[i]}`);
    }
  }
  console.log('✓ blob conversion works correctly');
}

function testFileTypeDetection() {
  console.log('Testing file type detection...');
  
  const textFiles = ['readme.txt', 'code.js', 'config.json', 'script.py', 'style.css'];
  const nonTextFiles = ['image.png', 'video.mp4', 'archive.zip', 'binary.exe'];
  
  for (const file of textFiles) {
    if (!isTextLike(file)) {
      throw new Error(`${file} should be detected as text-like`);
    }
  }
  
  for (const file of nonTextFiles) {
    if (isTextLike(file)) {
      throw new Error(`${file} should not be detected as text-like`);
    }
  }
  
  console.log('✓ file type detection works correctly');
}

function runTests() {
  console.log('Running unit tests...\n');
  
  try {
    testNormalize();
    testCosine();
    testBlobConversion();
    testFileTypeDetection();
    
    console.log('\n✓ All unit tests passed!');
  } catch (error) {
    console.error('\n✗ Unit test failed:', error);
    process.exit(1);
  }
}

runTests();
