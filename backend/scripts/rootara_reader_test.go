package main

import "testing"

func TestMultiallelicMatching(t *testing.T) {
	first := RootaraRecord{Ref: "A", Alt: "C", RSID: "rs1"}
	second := RootaraRecord{Ref: "A", Alt: "G", RSID: "rs2"}
	columns := map[string]int{"RSID": 0, "Chrom": 1, "Start": 2, "Genotype": 3}
	for _, pair := range [][]RootaraRecord{{first, second}, {second, first}} {
		reference := map[string]map[string][]RootaraRecord{"1": {"50": pair}}
		input := [][]string{{"rs1", "1", "50", "AC"}, {"rs2", "1", "50", "AA"}, {"unknown", "1", "50", "AA"}}
		got := mergeDataFrames(input, reference, columns)
		if len(got) != 2 || got[0].RSID != "rs1" || got[1].RSID != "rs2" {
			t.Fatalf("wrong candidates or ambiguous call emitted: %v", got)
		}
	}
}
