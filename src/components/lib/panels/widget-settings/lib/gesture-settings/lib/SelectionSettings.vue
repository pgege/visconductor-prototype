<script lang="ts" setup>
import {
  GestureSettingsState,
  currentChart,
  isUpdateFromAutocomplete,
} from "@/state";
import { ref, watchEffect } from "vue";

const selectOptions = ref<string[]>();
const fieldOptions = ref<string[]>();
const colorScale = ref();

watchEffect(() => {
  selectOptions.value = currentChart.value?.state.selectOptions;
  fieldOptions.value = currentChart.value?.state.dataFieldNames;
  colorScale.value = currentChart.value?.getColorScale();
});
</script>
<template>
  <v-row>
    <v-col lg="12">
      <v-autocomplete
        v-model="GestureSettingsState.selectionKeys"
        label="Items to select"
        :items="selectOptions"
        multiple
        chips
        clearable
        @update:modelValue="
          () => {
            isUpdateFromAutocomplete = true;
          }
        "
        hint="Enter the keys for the items you wish to select"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw">
            <template #prepend>
              <v-badge :color="colorScale(item.raw)" inline></v-badge>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>
    </v-col>
    <v-col>
      <v-autocomplete
        label="Label to display"
        :items="fieldOptions"
        clearable
        v-model="GestureSettingsState.selectionLabelKey"
      ></v-autocomplete>
    </v-col>
  </v-row>
</template>
<style></style>
