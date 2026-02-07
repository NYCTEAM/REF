// 测试分阶段佣金计算

// 🔥 分阶段计算佣金
// 业绩 0-2000 USDT: 10%
// 业绩 2001-10000 USDT: 15%
// 业绩 10001+ USDT: 20%
function calculateTieredCommission(totalPerformance) {
  let commission = 0;
  
  if (totalPerformance <= 0) {
    return 0;
  }
  
  // 第一阶段: 0-2000 USDT @ 10%
  if (totalPerformance <= 2000) {
    commission = totalPerformance * 0.10;
  } else {
    commission = 2000 * 0.10; // 前 2000 的佣金 = 200
    
    // 第二阶段: 2001-10000 USDT @ 15%
    if (totalPerformance <= 10000) {
      commission += (totalPerformance - 2000) * 0.15;
    } else {
      commission += 8000 * 0.15; // 2001-10000 的佣金 = 1200
      
      // 第三阶段: 10001+ USDT @ 20%
      commission += (totalPerformance - 10000) * 0.20;
    }
  }
  
  return commission;
}

// 测试案例
const testCases = [
  { performance: 1000, expected: 100, description: '1000 USDT (全部 10%)' },
  { performance: 2000, expected: 200, description: '2000 USDT (全部 10%)' },
  { performance: 3000, expected: 350, description: '3000 USDT (2000@10% + 1000@15%)' },
  { performance: 7000, expected: 950, description: '7000 USDT (2000@10% + 5000@15%)' },
  { performance: 10000, expected: 1400, description: '10000 USDT (2000@10% + 8000@15%)' },
  { performance: 15000, expected: 2400, description: '15000 USDT (2000@10% + 8000@15% + 5000@20%)' },
  { performance: 20000, expected: 3400, description: '20000 USDT (2000@10% + 8000@15% + 10000@20%)' },
];

console.log('🧪 测试分阶段佣金计算\n');
console.log('='.repeat(80));
console.log('业绩规则:');
console.log('  0-2000 USDT: 10%');
console.log('  2001-10000 USDT: 15%');
console.log('  10001+ USDT: 20%');
console.log('='.repeat(80) + '\n');

let allPassed = true;

testCases.forEach((testCase, index) => {
  const result = calculateTieredCommission(testCase.performance);
  const passed = Math.abs(result - testCase.expected) < 0.01;
  
  console.log(`测试 ${index + 1}: ${testCase.description}`);
  console.log(`  业绩: ${testCase.performance} USDT`);
  console.log(`  期望佣金: ${testCase.expected} USDT`);
  console.log(`  实际佣金: ${result} USDT`);
  console.log(`  状态: ${passed ? '✅ 通过' : '❌ 失败'}`);
  
  // 详细计算过程
  if (testCase.performance > 2000) {
    console.log(`  计算过程:`);
    console.log(`    第一阶段 (0-2000): 2000 × 10% = 200 USDT`);
    
    if (testCase.performance <= 10000) {
      const stage2 = testCase.performance - 2000;
      console.log(`    第二阶段 (2001-${testCase.performance}): ${stage2} × 15% = ${stage2 * 0.15} USDT`);
    } else {
      console.log(`    第二阶段 (2001-10000): 8000 × 15% = 1200 USDT`);
      const stage3 = testCase.performance - 10000;
      console.log(`    第三阶段 (10001-${testCase.performance}): ${stage3} × 20% = ${stage3 * 0.20} USDT`);
    }
  }
  
  console.log('');
  
  if (!passed) allPassed = false;
});

console.log('='.repeat(80));
if (allPassed) {
  console.log('✅ 所有测试通过！');
} else {
  console.log('❌ 部分测试失败！');
}
console.log('='.repeat(80));

// 特别验证 7000 USDT 的案例
console.log('\n🎯 特别验证: 7000 USDT 案例');
console.log('='.repeat(80));
const performance7000 = 7000;
const commission7000 = calculateTieredCommission(performance7000);

console.log(`业绩: ${performance7000} USDT`);
console.log(`\n计算过程:`);
console.log(`  第一阶段 (0-2000): 2000 × 10% = 200 USDT`);
console.log(`  第二阶段 (2001-7000): 5000 × 15% = 750 USDT`);
console.log(`  总佣金: 200 + 750 = 950 USDT`);
console.log(`\n实际计算结果: ${commission7000} USDT`);
console.log(`\n${commission7000 === 950 ? '✅ 正确！' : '❌ 错误！'}`);
console.log('='.repeat(80));
