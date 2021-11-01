#include "RuleGenerator.hpp"

RuleGenerator::RuleGenerator(shared_ptr<IGeneratorMeta> meta)
    : Generator(meta) {}
RuleGenerator::RuleGenerator(shared_ptr<IGeneratorMeta> meta,
                             vector<shared_ptr<Rule>> rules)
    : Generator(meta), _rules(rules) {}
vector<shared_ptr<Rule>> &RuleGenerator::rules() { return this->_rules; }
IGroupRepository *&RuleGenerator::repository() { return this->_repository; }

vector<shared_ptr<ILangResult>> RuleGenerator::results() {
  vector<shared_ptr<ILangResult>> results;
  if (this->_repository == nullptr) {
    return results;
  }
  for (const auto &rule : _rules) {
    if (rule == nullptr) {
      continue;
    }
    const auto &subs = rule->subs();
    size_t subs_sz = subs.size();
    if (subs_sz == 0) {
      continue;
    }
    // init
    vector<vector<shared_ptr<ILangResult>>> sub_results; // data holder
    for (const auto &sub : subs) {
      auto sub_result = _repository->get_group_results(sub);
      if (sub_result.size() == 0) {
        // zero-length group, not valid
        sub_results.clear();
        break;
      }
      sub_results.emplace_back(std::move(sub_result));
    }
    if (sub_results.size() == 0) {
      continue; // init failed, see clear() above
    }
    vector<vector<shared_ptr<ILangResult>>::const_iterator> begins{};
    vector<vector<shared_ptr<ILangResult>>::const_iterator> ends{};
    vector<shared_ptr<IGeneratorMeta>> meta_cache{};
    do {
      // fill
      for (size_t i = begins.size(); i < subs_sz; ++i) {
        begins.emplace_back(sub_results[i].cbegin());
        ends.emplace_back(sub_results[i].cend());
      }
      // generate conbination
      const IGeneratorMeta &meta_source = *meta();
      shared_ptr<GeneratorMeta> meta_conbination =
          std::make_shared<GeneratorMeta>(meta_source);
      vector<shared_ptr<ILangResult>> lang_conbination;
      for (const auto &begin : begins) {
        *meta_conbination += *((*begin)->meta());
        if (meta_conbination->group().empty()) {
          break;
        }
        lang_conbination.emplace_back(std::move(*begin));
      }
      if (meta_conbination->group().empty()) {
        continue; // generate failed.
      }
      // check meta cache
      auto meta_cached = std::find_if(
          meta_cache.cbegin(), meta_cache.cend(),
          [&, meta_conbination](const shared_ptr<IGeneratorMeta> that) -> bool {
            const IGeneratorMeta &that_ref = *that;
            return (*meta_conbination) == that_ref;
          });
      shared_ptr<IGeneratorMeta> final_meta(std::move(meta_conbination));
      if (meta_cached != meta_cache.end()) {
        final_meta = *meta_cached;
      } else {
        meta_cache.emplace_back(final_meta);
      }
      // generate RuleLangResult
      auto generated_result =
          std::make_shared<RuleLangResult>(final_meta, rule, lang_conbination);
      results.emplace_back(std::move(generated_result));
      // step
      for (size_t i = subs_sz - 1; i >= 0; --i) {
        if (++begins[i] == ends[i]) {
          begins.pop_back();
          ends.pop_back();
          sub_results.pop_back();
        } else {
          break;
        }
      }
    } while (begins.size() > 0);
  }
  return results;
}