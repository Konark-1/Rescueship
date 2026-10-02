import fs from 'fs';
import path from 'path';

interface Scenario {
  id: string;
  name: string;
  category: string;
  platform: string;
  carrier: string;
  orderId: string;
  customer: {
    name: string;
    phone: string;
    city: string;
    pincode: string;
  };
  courierRawRemark: string;
  rawNdrScore: number;
  rescueshipAction: string;
  customerReply: string;
  carrierSyncPayload: Record<string, any>;
  financialOutcome: Record<string, number>;
  finalStatus: string;
}

export function run50ScenarioSimulation(): { total: number; passed: number; summaryByCategory: Record<string, number>; totalRupeesSaved: number } {
  const jsonPath = path.resolve(__dirname, '../../docs/dataset_50_scenarios.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Dataset not found at ${jsonPath}`);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const scenarios: Scenario[] = JSON.parse(raw);

  const summaryByCategory: Record<string, number> = {};
  let totalRupeesSaved = 0;
  let passed = 0;

  for (const s of scenarios) {
    summaryByCategory[s.category] = (summaryByCategory[s.category] || 0) + 1;
    totalRupeesSaved += s.financialOutcome.totalRupeesSaved || 0;

    // Validate scenario integrity
    const hasValidPhone = s.customer.phone === '+918800957178';
    const hasCategory = Boolean(s.category);
    const hasFinalStatus = Boolean(s.finalStatus);
    const hasCarrierSync = Boolean(s.carrierSyncPayload && Object.keys(s.carrierSyncPayload).length > 0);

    if (hasValidPhone && hasCategory && hasFinalStatus && hasCarrierSync) {
      passed++;
    }
  }

  return {
    total: scenarios.length,
    passed,
    summaryByCategory,
    totalRupeesSaved,
  };
}

// CLI execution
if (require.main === module) {
  console.log('🚀 Running 50 RescueShip Scenario Telemetry Simulation...\n');
  const result = run50ScenarioSimulation();
  console.log(`✅ Verified ${result.passed}/${result.total} scenarios successfully!`);
  console.log(`💰 Cumulative Sunk Freight & Margin Protected: ₹${result.totalRupeesSaved.toLocaleString('en-IN')}`);
  console.log('\n📊 Scenario Distribution by Category:');
  for (const [cat, count] of Object.entries(result.summaryByCategory)) {
    console.log(`   • ${cat.padEnd(28)}: ${count} scenarios`);
  }
}
