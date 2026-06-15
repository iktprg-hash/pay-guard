import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { resolvePriorityLevel } from "@/lib/financial/priorityLevel";
import {
  formatMoney as formatLocaleMoney,
  getIntlLocale,
} from "@/lib/financial/locale-config";
import type { PdfLabels } from "@/lib/pdf/labels";
import type {
  FinancialProfile,
  PrioritizationResult,
  UserFinancialProfile,
} from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    color: "#111827",
    lineHeight: 1.45,
  },
  header: {
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1d4ed8",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#6b7280",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: "#111827",
  },
  section: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  infoLabel: {
    color: "#4b5563",
  },
  infoValue: {
    fontWeight: 700,
  },
  summaryBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  colIndex: { width: "6%" },
  colCreditor: { width: "22%" },
  colAmount: { width: "16%", textAlign: "right" },
  colLevel: { width: "16%" },
  colReason: { width: "40%" },
  headerCell: {
    fontSize: 8,
    fontWeight: 700,
    color: "#374151",
    textTransform: "uppercase",
  },
  cell: {
    fontSize: 9,
  },
  warningBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 6,
    padding: 10,
  },
  warningTitle: {
    fontWeight: 700,
    color: "#b45309",
    marginBottom: 6,
  },
  warningItem: {
    marginBottom: 3,
    color: "#92400e",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
});

export interface RecommendationPDFProps {
  recommendation: PrioritizationResult;
  profile?: FinancialProfile | UserFinancialProfile;
  locale: Locale;
  labels: PdfLabels;
  generatedAt?: string;
}

function formatMoney(amount: number, locale: Locale): string {
  return formatLocaleMoney(amount, locale);
}

function profileAvailableFunds(
  profile: FinancialProfile | UserFinancialProfile | undefined
): number | null {
  if (!profile) return null;
  return profile.availableFunds;
}

export function RecommendationPDF({
  recommendation,
  profile,
  locale,
  labels,
  generatedAt,
}: RecommendationPDFProps) {
  const dateStr =
    generatedAt ??
    new Date().toLocaleDateString(getIntlLocale(locale), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const availableFunds = profileAvailableFunds(profile);

  return (
    <Document title={labels.title} author="Pay Guard">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.subtitle}>
            {labels.generatedAt}: {dateStr}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.userSection}</Text>
          {availableFunds != null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{labels.availableFunds}</Text>
              <Text style={styles.infoValue}>
                {formatMoney(availableFunds, locale)}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{labels.spendableFunds}</Text>
            <Text style={styles.infoValue}>
              {formatMoney(recommendation.spendableFunds, locale)}
            </Text>
          </View>
          {recommendation.lifeBuffer > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{labels.buffer}</Text>
              <Text style={styles.infoValue}>
                {formatMoney(recommendation.lifeBuffer, locale)} (
                {Math.round(recommendation.lifeBufferPercent * 100)} %)
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.summary}</Text>
          <View style={styles.summaryBox}>
            <Text>{recommendation.summary}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.paymentsSection}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.colIndex]}>
                {labels.index}
              </Text>
              <Text style={[styles.headerCell, styles.colCreditor]}>
                {labels.creditor}
              </Text>
              <Text style={[styles.headerCell, styles.colAmount]}>
                {labels.amount}
              </Text>
              <Text style={[styles.headerCell, styles.colLevel]}>
                {labels.level}
              </Text>
              <Text style={[styles.headerCell, styles.colReason]}>
                {labels.reason}
              </Text>
            </View>

            {recommendation.recommendations.map((rec, index) => {
              const level = resolvePriorityLevel(rec);
              const explanation = rec.explanation || rec.reason;
              return (
                <View key={rec.debtId} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.cell, styles.colIndex]}>
                    {index + 1}
                  </Text>
                  <Text style={[styles.cell, styles.colCreditor]}>
                    {rec.creditor}
                  </Text>
                  <Text style={[styles.cell, styles.colAmount]}>
                    {formatMoney(rec.recommendedAmount, locale)}
                  </Text>
                  <Text style={[styles.cell, styles.colLevel]}>
                    {labels.levels[level]} ({level})
                  </Text>
                  <Text style={[styles.cell, styles.colReason]}>
                    {explanation}
                    {" · "}
                    {labels.categories[rec.category]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{labels.remaining}</Text>
            <Text style={styles.infoValue}>
              {formatMoney(recommendation.remainingFunds, locale)}
            </Text>
          </View>
        </View>

        {recommendation.warnings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>{labels.warnings}</Text>
              {recommendation.warnings.map((warning, i) => (
                <Text key={i} style={styles.warningItem}>
                  • {warning}
                </Text>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer} fixed>
          {labels.footer}
        </Text>
      </Page>
    </Document>
  );
}
