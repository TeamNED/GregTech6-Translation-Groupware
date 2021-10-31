#ifndef RULEGENERATOR_H
#define RULEGENERATOR_H
#pragma once

#include <algorithm>

#include "../lang_result/RuleLangResult.hpp"
#include "../meta/GeneratorMeta.hpp"
#include "../meta/IGroupRepository.hpp"
#include "Generator.hpp"
#include "Rule.hpp"

class RuleGenerator : public virtual Generator {
private:
  vector<shared_ptr<Rule>> _rules;
  vector<shared_ptr<ILangResult>> _results;
  IGroupRepository *_repository = nullptr;

public:
  RuleGenerator(shared_ptr<IGeneratorMeta> meta);
  RuleGenerator(shared_ptr<IGeneratorMeta> meta,
                vector<shared_ptr<Rule>> rules);
  vector<shared_ptr<Rule>> &rules();
  IGroupRepository *&repository();
  virtual vector<shared_ptr<ILangResult>> results() override;
};
#endif